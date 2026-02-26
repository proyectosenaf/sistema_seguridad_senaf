// server/modules/iam/routes/password-reset.routes.js
import { Router } from "express";
import crypto from "node:crypto";

import IamUser from "../models/IamUser.model.js";
import { hashPassword } from "../utils/password.util.js";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function isProd() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

/**
 * Hash estable para token temporal (NO guardar token en claro en DB)
 * Recomendación: define IAM_RESET_PEPPER en prod.
 */
function hashResetToken(token) {
  const pepper = String(process.env.IAM_RESET_PEPPER || "").trim() || "dev_pepper";
  return crypto.createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

function makeResetToken() {
  // 6 bytes => 12 hex chars (suficiente para reset temporal)
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function isExpired(date) {
  if (!date) return true;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? true : Date.now() > t;
}

// Hook opcional: integra tu proveedor de correo aquí.
async function sendResetEmail({ email, token }) {
  // En producción, aquí deberías mandar correo (SendGrid / SES / SMTP).
  // Mantengo stub para no romper.
  if (!isProd()) {
    // eslint-disable-next-line no-console
    console.log("[password-reset] DEV token for", email, "=>", token);
  }
  return true;
}

/**
 * POST /api/iam/v1/auth/request-password-reset
 * Body: { email }
 *
 * - Genera token temporal y lo guarda hasheado.
 * - En DEV responde token para pruebas.
 * - En PROD responde genérico (no filtrar si email existe o no).
 */
r.post("/request-password-reset", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    // Respuesta genérica para evitar enumeración de usuarios
    const genericOk = () =>
      res.json({
        ok: true,
        message: "Si el correo existe, se enviaron instrucciones para restablecer la contraseña.",
      });

    const user = await IamUser.findOne({ email });

    // No revelamos si existe o no
    if (!user) return genericOk();

    // Solo para usuarios locales
    if (user.provider !== "local") return genericOk();

    // Si está inactivo, también genérico
    if (!user.active) return genericOk();

    // Generar token y persistir hash + expiración
    const token = makeResetToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

    user.tempPassHash = hashResetToken(token);
    user.tempPassExpiresAt = expiresAt;
    user.tempPassUsedAt = null;
    user.tempPassAttempts = 0;

    await user.save();

    // En PROD: manda email
    await sendResetEmail({ email: user.email, token });

    // DEV: devolver token para pruebas (si no tienes mail aún)
    if (!isProd()) {
      return res.json({
        ok: true,
        message:
          "DEV: token generado. En producción esto se envía por correo.",
        token,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return genericOk();
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

/**
 * POST /api/iam/v1/auth/reset-password
 * Body: { email, token, passwordNueva }
 *
 * - Valida token temporal (hash) + expiración + intentos
 * - Cambia passwordHash
 * - Limpia tempPass*
 * - Limpia mustChangePassword y fija passwordExpiresAt (+2 meses)
 */
r.post("/reset-password", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const token = String(req.body?.token || "").trim().toUpperCase();
    const passwordNueva = String(req.body?.passwordNueva || "");

    if (!email || !token || !passwordNueva) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (passwordNueva.length < 8) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    const user = await IamUser.findOne({ email }).select("+passwordHash +tempPassHash");

    // Respuesta genérica (no enumeración)
    if (!user || user.provider !== "local" || user.active === false) {
      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    // Validaciones token temporal
    if (!user.tempPassHash || !user.tempPassExpiresAt) {
      return res.status(400).json({ ok: false, error: "reset_not_requested" });
    }
    if (user.tempPassUsedAt) {
      return res.status(400).json({ ok: false, error: "reset_already_used" });
    }
    if (isExpired(user.tempPassExpiresAt)) {
      return res.status(400).json({ ok: false, error: "reset_expired" });
    }

    // Limitar intentos
    const maxAttempts = Number(process.env.IAM_RESET_MAX_ATTEMPTS || 5);
    if ((user.tempPassAttempts || 0) >= maxAttempts) {
      return res.status(429).json({ ok: false, error: "too_many_attempts" });
    }

    const expectedHash = user.tempPassHash;
    const gotHash = hashResetToken(token);

    if (expectedHash !== gotHash) {
      user.tempPassAttempts = (user.tempPassAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ ok: false, error: "invalid_reset_token" });
    }

    // ✅ Cambiar password
    const newHash = await hashPassword(passwordNueva);

    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 2);

    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.passwordExpiresAt = expires;

    // marcar token como usado y limpiar
    user.tempPassUsedAt = now;
    user.tempPassHash = "";
    user.tempPassExpiresAt = null;
    user.tempPassAttempts = 0;

    await user.save();

    return res.json({
      ok: true,
      message: "Contraseña restablecida correctamente. Ya puedes iniciar sesión.",
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

export default r;