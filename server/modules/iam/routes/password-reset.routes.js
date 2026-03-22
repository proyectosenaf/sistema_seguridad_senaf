// server/modules/iam/routes/password-reset.routes.js
import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { hashPassword } from "../utils/password.util.js";
import {
  normEmail,
  hashResetToken,
  makeResetToken,
  isExpired,
  isProd,
} from "../utils/passwordReset.util.js";
import { sendResetEmail } from "../services/passwordReset.mailer.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

const r = Router();

function normalizeRoleValue(role) {
  if (!role) return "";

  if (typeof role === "string") {
    return role.trim();
  }

  if (role && typeof role === "object") {
    const candidates = [
      role.name,
      role.slug,
      role.code,
      role.key,
      role.nombre,
      role.label,
    ];

    const found = candidates.find((value) => String(value || "").trim() !== "");
    return String(found || "").trim();
  }

  return String(role).trim();
}

function getPrimaryRole(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return normalizeRoleValue(roles[0] || "");
}

function hasRole(user, roleName) {
  const wanted = String(roleName || "").trim().toLowerCase();
  if (!wanted) return false;

  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return roles.some((role) => {
    if (typeof role === "string") {
      return role.trim().toLowerCase() === wanted;
    }

    if (role && typeof role === "object") {
      const candidates = [
        role.name,
        role.slug,
        role.code,
        role.key,
        role.nombre,
        role.label,
      ];

      return candidates.some(
        (value) => String(value || "").trim().toLowerCase() === wanted
      );
    }

    return false;
  });
}

function genericResetResponse(res) {
  return res.json({
    ok: true,
    message:
      "Si el correo existe, se enviaron instrucciones para restablecer la contraseña.",
  });
}

function passwordPolicy(password) {
  const s = String(password || "");

  if (s.length < 8) {
    return "Debe tener al menos 8 caracteres.";
  }

  if (!/[A-Za-z]/.test(s)) {
    return "Debe incluir al menos una letra.";
  }

  if (!/\d/.test(s)) {
    return "Debe incluir al menos un número.";
  }

  if (!/[^A-Za-z0-9]/.test(s)) {
    return "Debe incluir al menos un carácter especial.";
  }

  return null;
}

function clientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    ""
  );
}

function auditActor(req, user = null, fallbackEmail = "") {
  return {
    agente:
      req?.user?.email ||
      req?.user?.name ||
      user?.email ||
      user?.name ||
      fallbackEmail ||
      "Sistema IAM",
    actorId:
      req?.user?.sub ||
      req?.user?._id ||
      req?.user?.id ||
      (user?._id ? String(user._id) : ""),
    actorEmail: req?.user?.email || user?.email || fallbackEmail || "",
    actorRol: getPrimaryRole(user || req?.user),
    ip: clientIp(req),
    userAgent: req.get("user-agent") || "",
  };
}

async function logIamResetEvent(req, payload = {}) {
  try {
    await logBitacoraEvent({
      modulo: "IAM",
      tipo: "IAM",
      prioridad: payload.prioridad || "Media",
      estado: payload.estado || "Registrado",
      source: payload.source || "iam-password-reset",
      ...auditActor(req, payload.user || null, payload.fallbackEmail || ""),
      ...payload,
    });
  } catch (err) {
    console.error("[iam][bitacora][password-reset] error:", err?.message || err);
  }
}

r.post("/request-password-reset", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);

    if (!email) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        titulo: "Solicitud de recuperación inválida",
        descripcion:
          "Se intentó solicitar recuperación de contraseña sin correo válido.",
        estado: "Fallido",
        prioridad: "Media",
        fallbackEmail: "",
      });

      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const user = await IamUser.findOne({ email })
      .select(
        "_id email name roles active provider tempPassHash tempPassExpiresAt tempPassUsedAt tempPassAttempts updatedAt"
      )
      .exec();

    if (!user) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        titulo: "Solicitud de recuperación para usuario inexistente",
        descripcion: `Se solicitó recuperación para el correo ${email}, pero no existe usuario.`,
        estado: "Denegado",
        prioridad: "Media",
        fallbackEmail: email,
        nombre: email,
      });

      return genericResetResponse(res);
    }

    if (String(user.provider || "").toLowerCase() !== "local") {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Recuperación rechazada por provider",
        descripcion: `El usuario ${user.email} no pertenece al provider local.`,
        estado: "Denegado",
        prioridad: "Media",
        nombre: user.name || user.email,
        meta: { provider: user.provider || "" },
      });

      return genericResetResponse(res);
    }

    if (user.active === false) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Recuperación rechazada por usuario inactivo",
        descripcion: `El usuario ${user.email} está inactivo.`,
        estado: "Denegado",
        prioridad: "Media",
        nombre: user.name || user.email,
      });

      return genericResetResponse(res);
    }

    if (hasRole(user, "visita")) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Recuperación rechazada para visitante",
        descripcion: `El usuario ${user.email} tiene rol de visita y no puede usar este flujo.`,
        estado: "Denegado",
        prioridad: "Media",
        nombre: user.name || user.email,
      });

      return genericResetResponse(res);
    }

    const now = new Date();
    const recentRequestWindowMs = 60 * 1000;

    const hasRecent =
      user.tempPassExpiresAt &&
      !isExpired(user.tempPassExpiresAt) &&
      user.tempPassUsedAt == null &&
      user.updatedAt &&
      now.getTime() - new Date(user.updatedAt).getTime() < recentRequestWindowMs;

    if (hasRecent) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Solicitud de recuperación reutilizada",
        descripcion: `Ya existe una solicitud reciente de recuperación para ${user.email}.`,
        estado: "Exitoso",
        prioridad: "Baja",
        nombre: user.name || user.email,
        meta: {
          tempPassExpiresAt: user.tempPassExpiresAt || null,
          tempPassUsedAt: user.tempPassUsedAt || null,
        },
      });

      return genericResetResponse(res);
    }

    const token = String(makeResetToken()).trim().toUpperCase();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    user.tempPassHash = hashResetToken(token);
    user.tempPassExpiresAt = expiresAt;
    user.tempPassUsedAt = null;
    user.tempPassAttempts = 0;

    await user.save();

    console.log("[IAM][PASSWORD_RESET] Intentando enviar correo a:", user.email);
    console.log("[IAM][PASSWORD_RESET] Entorno producción:", isProd());

    try {
      await sendResetEmail({
        email: user.email,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      console.log("[IAM][PASSWORD_RESET] Correo enviado correctamente a:", user.email);
    } catch (mailError) {
      console.error(
        "[IAM][PASSWORD_RESET] Error enviando correo:",
        mailError?.message || mailError
      );

      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_REQUEST",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Error enviando correo de recuperación",
        descripcion:
          mailError?.message ||
          `No se pudo enviar el correo de recuperación a ${user.email}.`,
        estado: "Fallido",
        prioridad: "Alta",
        nombre: user.name || user.email,
        meta: {
          expiresAt: expiresAt.toISOString(),
          mailError:
            mailError?.response ||
            mailError?.code ||
            mailError?.message ||
            String(mailError),
        },
      });

      return res.status(500).json({
        ok: false,
        error: "email_send_failed",
        message:
          "Se generó el código de recuperación, pero no se pudo enviar el correo.",
        ...(!isProd()
          ? {
              debug: {
                token,
                expiresAt: expiresAt.toISOString(),
              },
            }
          : {}),
      });
    }

    await logIamResetEvent(req, {
      accion: "PASSWORD_RESET_REQUEST",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Solicitud de recuperación generada",
      descripcion: `Se generó y envió un token de recuperación para ${user.email}.`,
      estado: "Exitoso",
      prioridad: "Media",
      nombre: user.name || user.email,
      meta: {
        expiresAt: expiresAt.toISOString(),
        devTokenVisible: !isProd(),
      },
    });

    if (!isProd()) {
      return res.json({
        ok: true,
        message:
          "DEV: correo intentado y token generado correctamente. Revisa también la bandeja y logs SMTP.",
        token,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return genericResetResponse(res);
  } catch (e) {
    console.error("request-password-reset error:", e);

    await logIamResetEvent(req, {
      accion: "PASSWORD_RESET_REQUEST",
      entidad: "IamUser",
      titulo: "Error en solicitud de recuperación",
      descripcion:
        e?.message ||
        "No se pudo procesar la solicitud de recuperación de contraseña.",
      estado: "Fallido",
      prioridad: "Alta",
      fallbackEmail: normEmail(req.body?.email || ""),
      nombre: normEmail(req.body?.email || ""),
    });

    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "No se pudo procesar la recuperación de contraseña.",
    });
  }
});

r.post("/reset-password", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const token = String(req.body?.token || "").trim().toUpperCase();
    const passwordNueva = String(req.body?.passwordNueva || "");
    const confirmarPassword = String(req.body?.confirmarPassword || "");

    if (!email || !token || !passwordNueva || !confirmarPassword) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        titulo: "Reset de contraseña inválido por campos faltantes",
        descripcion: `Se intentó restablecer contraseña para ${email || "correo vacío"} con datos incompletos.`,
        estado: "Fallido",
        prioridad: "Media",
        fallbackEmail: email,
        nombre: email,
      });

      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    if (passwordNueva !== confirmarPassword) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        titulo: "Reset rechazado por contraseñas distintas",
        descripcion: `La confirmación de contraseña no coincide para ${email}.`,
        estado: "Fallido",
        prioridad: "Media",
        fallbackEmail: email,
        nombre: email,
      });

      return res.status(400).json({ ok: false, error: "password_mismatch" });
    }

    const policyError = passwordPolicy(passwordNueva);
    if (policyError) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        titulo: "Reset rechazado por política de contraseña",
        descripcion: `La nueva contraseña de ${email} no cumple política: ${policyError}`,
        estado: "Fallido",
        prioridad: "Media",
        fallbackEmail: email,
        nombre: email,
      });

      return res.status(400).json({
        ok: false,
        error: "invalid_password",
        message: policyError,
      });
    }

    const user = await IamUser.findOne({ email })
      .select(
        "+passwordHash +tempPassHash tempPassExpiresAt tempPassUsedAt tempPassAttempts roles active provider mustChangePassword passwordChangedAt passwordExpiresAt name email"
      )
      .exec();

    if (!user) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        titulo: "Reset rechazado por usuario inexistente",
        descripcion: `No existe usuario para el correo ${email}.`,
        estado: "Fallido",
        prioridad: "Media",
        fallbackEmail: email,
        nombre: email,
      });

      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (String(user.provider || "").toLowerCase() !== "local") {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Reset rechazado por provider",
        descripcion: `El usuario ${user.email} no pertenece al provider local.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
        meta: { provider: user.provider || "" },
      });

      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (user.active === false) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Reset rechazado por usuario inactivo",
        descripcion: `El usuario ${user.email} está inactivo.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
      });

      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (hasRole(user, "visita")) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Reset rechazado para visitante",
        descripcion: `El usuario ${user.email} tiene rol visita y no puede usar este flujo.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
      });

      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (!user.tempPassHash || !user.tempPassExpiresAt) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Reset no solicitado",
        descripcion: `El usuario ${user.email} no tiene solicitud activa de recuperación.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
      });

      return res.status(400).json({ ok: false, error: "reset_not_requested" });
    }

    if (user.tempPassUsedAt) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Token de reset ya utilizado",
        descripcion: `El token de recuperación del usuario ${user.email} ya fue utilizado.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
        meta: { tempPassUsedAt: user.tempPassUsedAt || null },
      });

      return res.status(400).json({ ok: false, error: "reset_already_used" });
    }

    if (isExpired(user.tempPassExpiresAt)) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Token de reset expirado",
        descripcion: `El token de recuperación del usuario ${user.email} expiró.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
        meta: { tempPassExpiresAt: user.tempPassExpiresAt || null },
      });

      return res.status(400).json({ ok: false, error: "reset_expired" });
    }

    const maxAttempts = Number(process.env.IAM_RESET_MAX_ATTEMPTS || 5);
    if ((user.tempPassAttempts || 0) >= maxAttempts) {
      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Reset bloqueado por intentos máximos",
        descripcion: `El usuario ${user.email} excedió los intentos permitidos para el token de recuperación.`,
        estado: "Bloqueado",
        prioridad: "Alta",
        nombre: user.name || user.email,
        meta: {
          tempPassAttempts: user.tempPassAttempts || 0,
          maxAttempts,
        },
      });

      return res.status(429).json({ ok: false, error: "too_many_attempts" });
    }

    const gotHash = hashResetToken(token);
    if (gotHash !== user.tempPassHash) {
      user.tempPassAttempts = (user.tempPassAttempts || 0) + 1;
      await user.save();

      await logIamResetEvent(req, {
        accion: "PASSWORD_RESET_CONFIRM",
        entidad: "IamUser",
        entidadId: String(user._id),
        user,
        titulo: "Token de reset inválido",
        descripcion: `El usuario ${user.email} ingresó un token de recuperación inválido.`,
        estado: "Fallido",
        prioridad: "Media",
        nombre: user.name || user.email,
        meta: {
          tempPassAttempts: user.tempPassAttempts || 0,
          maxAttempts,
        },
      });

      return res.status(400).json({ ok: false, error: "invalid_reset_token" });
    }

    const before = {
      mustChangePassword: !!user.mustChangePassword,
      passwordChangedAt: user.passwordChangedAt || null,
      passwordExpiresAt: user.passwordExpiresAt || null,
      tempPassExpiresAt: user.tempPassExpiresAt || null,
      tempPassUsedAt: user.tempPassUsedAt || null,
      tempPassAttempts: user.tempPassAttempts || 0,
    };

    const newHash = await hashPassword(passwordNueva);
    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 2);

    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.passwordExpiresAt = expires;

    user.tempPassHash = "";
    user.tempPassExpiresAt = null;
    user.tempPassUsedAt = now;
    user.tempPassAttempts = 0;

    await user.save();

    await logIamResetEvent(req, {
      accion: "PASSWORD_RESET_CONFIRM",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Contraseña restablecida correctamente",
      descripcion: `El usuario ${user.email} restableció su contraseña exitosamente mediante token de recuperación.`,
      estado: "Exitoso",
      prioridad: "Media",
      nombre: user.name || user.email,
      before,
      after: {
        mustChangePassword: !!user.mustChangePassword,
        passwordChangedAt: user.passwordChangedAt || null,
        passwordExpiresAt: user.passwordExpiresAt || null,
        tempPassExpiresAt: user.tempPassExpiresAt || null,
        tempPassUsedAt: user.tempPassUsedAt || null,
        tempPassAttempts: user.tempPassAttempts || 0,
      },
    });

    return res.json({
      ok: true,
      message:
        "Contraseña restablecida correctamente. Ya puedes iniciar sesión.",
    });
  } catch (e) {
    console.error("reset-password error:", e);

    await logIamResetEvent(req, {
      accion: "PASSWORD_RESET_CONFIRM",
      entidad: "IamUser",
      titulo: "Error restableciendo contraseña",
      descripcion:
        e?.message || "No se pudo completar el restablecimiento de contraseña.",
      estado: "Fallido",
      prioridad: "Alta",
      fallbackEmail: normEmail(req.body?.email || ""),
      nombre: normEmail(req.body?.email || ""),
    });

    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "No se pudo restablecer la contraseña.",
    });
  }
});

export default r;