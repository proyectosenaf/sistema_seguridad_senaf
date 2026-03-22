import { Router } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import IamUser from "../models/IamUser.model.js";
import AuthOtp from "../models/AuthOtp.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import { getSecuritySettings } from "../services/settings.service.js";
import { sendOtpEmail } from "../services/otp.mailer.js";
import { normEmail, makeOtp, hashOtp } from "../utils/otp.util.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

const r = Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ---------------------- helpers ---------------------- */
function maskEmail(email) {
  const e = normEmail(email);
  const [u, d] = e.split("@");
  if (!u || !d) return e;
  const uu = u.length <= 2 ? `${u[0] || ""}*` : `${u.slice(0, 2)}***`;
  return `${uu}@${d}`;
}

function envStr(name) {
  const v = String(process.env[name] || "").trim();
  return v || null;
}

function envNum(name, def) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : def;
}

function getOtpSettings() {
  const s = getSecuritySettings?.() || {};
  const otp = s.otp || {};

  const ttlEnv = envNum("OTP_TTL_SECONDS", NaN);
  const maxEnv = envNum("OTP_MAX_ATTEMPTS", NaN);
  const resendEnv = envNum("OTP_RESEND_COOLDOWN_SECONDS", NaN);

  return {
    ttlSeconds: Number.isFinite(ttlEnv)
      ? ttlEnv
      : Number.isFinite(Number(otp.ttlSeconds))
      ? Number(otp.ttlSeconds)
      : 300,

    maxAttempts: Number.isFinite(maxEnv)
      ? maxEnv
      : Number.isFinite(Number(otp.maxAttempts))
      ? Number(otp.maxAttempts)
      : 5,

    resendCooldownSeconds: Number.isFinite(resendEnv)
      ? resendEnv
      : Number.isFinite(Number(otp.resendCooldownSeconds))
      ? Number(otp.resendCooldownSeconds)
      : 30,

    features: s.features || {},
    password: s.password || {},
  };
}

function normProvider(p) {
  const v = String(p ?? "local").trim().toLowerCase();
  return v || "local";
}

function jwtSecret() {
  const s = envStr("JWT_SECRET");
  if (!s) {
    if (IS_PROD) throw new Error("JWT_SECRET is required in production");
    return "dev_secret";
  }
  return s;
}

function signLocalJwt(payload) {
  const secret = jwtSecret();
  const expiresIn = String(process.env.JWT_EXPIRES_IN || "12h");
  return jwt.sign(payload, secret, { expiresIn, algorithm: "HS256" });
}

function normalizeRoleValue(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim();

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    ).trim();
  }

  return String(role).trim();
}

function getPrimaryRole(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return normalizeRoleValue(roles[0] || "");
}

function hasRole(user, role) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles
    .map((x) => normalizeRoleValue(x).toLowerCase())
    .includes(String(role).toLowerCase());
}

function isPasswordExpired(user) {
  if (!user?.passwordExpiresAt) return false;
  const d = new Date(user.passwordExpiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return new Date() > d;
}

function secondsRemaining(dateObj) {
  if (!dateObj) return 0;
  const t = new Date(dateObj).getTime();
  if (!Number.isFinite(t)) return 0;
  const diffMs = t - Date.now();
  return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
}

function clientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    ""
  );
}

function auditActor(req, user = null, fallbackName = "Sistema IAM") {
  return {
    agente:
      req?.user?.email ||
      req?.user?.name ||
      user?.email ||
      user?.name ||
      fallbackName,
    actorId:
      req?.user?.sub ||
      req?.user?._id ||
      req?.user?.id ||
      (user?._id ? String(user._id) : ""),
    actorEmail: req?.user?.email || user?.email || "",
    actorRol: getPrimaryRole(user || req?.user),
    ip: clientIp(req),
    userAgent: req.get("user-agent") || "",
  };
}

async function logIamEvent(req, payload = {}) {
  try {
    await logBitacoraEvent({
      modulo: "IAM",
      tipo: "IAM",
      prioridad: payload.prioridad || "Media",
      estado: payload.estado || "Registrado",
      source: payload.source || "iam",
      ...auditActor(req, payload.user || null, payload.fallbackName || "Sistema IAM"),
      ...payload,
    });
  } catch (err) {
    console.error("[iam][bitacora] error:", err?.message || err);
  }
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Busca el usuario por email de forma robusta:
 * 1) exact match normalizado
 * 2) fallback case-insensitive y tolerando espacios accidentales
 *
 * Esto corrige el caso donde en Mongo el email quedó con mayúsculas
 * o espacios por migraciones/datos viejos.
 */
async function findIamUserByEmail(email, select = "") {
  const e = normEmail(email);
  if (!e) return null;

  let user = await IamUser.findOne({ email }).select(select).exec();
  if (user) return user;

  user = await IamUser.findOne({ email: e }).select(select).exec();
  if (user) return user;

  const safe = escapeRegex(e);
  const spacedRegex = new RegExp(`^\\s*${safe}\\s*$`, "i");

  user = await IamUser.findOne({
    $or: [{ email: spacedRegex }],
  })
    .select(select)
    .exec();

  return user;
}

/* ---------------------- Reset token (pwreset) ---------------------- */
function signPwResetToken({ email, userId }) {
  const secret = jwtSecret();
  const payload = { typ: "pwreset", email: normEmail(email), uid: String(userId) };
  const expMinutes = envNum("PWRESET_TOKEN_TTL_MINUTES", 10);
  return jwt.sign(payload, secret, {
    expiresIn: `${expMinutes}m`,
    algorithm: "HS256",
  });
}

function verifyPwResetToken(token) {
  const secret = jwtSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (!decoded || decoded.typ !== "pwreset") {
    throw new Error("invalid_pwreset_token");
  }
  return decoded;
}

/* =========================================================
   OTP en Mongo (AuthOtp)
========================================================= */

async function expireActiveOtps(email, purpose) {
  await AuthOtp.updateMany(
    {
      email,
      purpose,
      status: "active",
      consumedAt: null,
    },
    {
      $set: { status: "expired" },
    }
  ).exec();
}

async function getActiveOtp(email, purpose) {
  return AuthOtp.findOne({
    email,
    purpose,
    status: "active",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .exec();
}

function isExpiredDoc(doc) {
  if (!doc?.expiresAt) return true;
  const exp = new Date(doc.expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return new Date() > exp;
}

function canResendDoc(doc) {
  if (!doc?.resendAfter) return true;
  const ra = new Date(doc.resendAfter);
  if (Number.isNaN(ra.getTime())) return true;
  return new Date() >= ra;
}

/**
 * Para LOGIN:
 * - si ya existe OTP activo y NO expiró, no generamos otro
 */
async function getOrCreateActiveOtpForLogin({
  email,
  purpose,
  ttlSeconds,
  maxAttempts,
  resendCooldownSeconds,
  metaUserId,
}) {
  const existing = await getActiveOtp(email, purpose);

  if (existing && !isExpiredDoc(existing)) {
    return {
      ok: true,
      reused: true,
      expiresAt: existing.expiresAt,
      resendAfter: existing.resendAfter,
    };
  }

  return createOrReplaceActiveOtpDocAtomic({
    email,
    purpose,
    ttlSeconds,
    maxAttempts,
    resendCooldownSeconds,
    metaUserId,
  });
}

/**
 * Para RESEND:
 * - sí puede reemplazar el OTP cuando el cooldown lo permita
 */
async function createOrReplaceActiveOtpDocAtomic({
  email,
  purpose,
  ttlSeconds,
  maxAttempts,
  resendCooldownSeconds,
  metaUserId,
}) {
  const now = new Date();
  const existing = await getActiveOtp(email, purpose);

  if (existing && !isExpiredDoc(existing) && !canResendDoc(existing)) {
    return {
      ok: false,
      cooldown: true,
      resendAfter: existing.resendAfter,
      expiresAt: existing.expiresAt,
    };
  }

  await expireActiveOtps(email, purpose);

  const code = makeOtp(6);
  const codeHash = hashOtp(email, code);

  const expiresAt = new Date(now.getTime() + Number(ttlSeconds || 300) * 1000);
  const resendAfter = new Date(
    now.getTime() + Number(resendCooldownSeconds || 30) * 1000
  );

  try {
    await AuthOtp.create({
      email,
      purpose,
      codeHash,
      expiresAt,
      resendAfter,
      attempts: 0,
      maxAttempts: Number(maxAttempts || 5),
      consumedAt: null,
      status: "active",
      meta: { userId: metaUserId || null },
    });

    return { ok: true, reused: false, code, expiresAt, resendAfter };
  } catch (err) {
    if (err && (err.code === 11000 || err.codeName === "DuplicateKey")) {
      const doc = await getActiveOtp(email, purpose);
      return {
        ok: false,
        cooldown: true,
        resendAfter: doc?.resendAfter || null,
        expiresAt: doc?.expiresAt || null,
      };
    }
    throw err;
  }
}

/* =========================================================
   Handlers
========================================================= */

async function loginOtpHandler(req, res) {
  const settings = getOtpSettings();

  const email = normEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    await logIamEvent(req, {
      accion: "LOGIN_OTP_INTENTO",
      entidad: "IamUser",
      titulo: "Intento de login OTP inválido",
      descripcion: "Se intentó iniciar sesión sin email o contraseña.",
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-login",
      nombre: email || "",
      actorEmail: email || "",
    });

    return res
      .status(400)
      .json({ ok: false, error: "email_and_password_required" });
  }

  const user = await findIamUserByEmail(
    email,
    "+passwordHash roles +active +provider mustChangePassword otpVerifiedAt passwordExpiresAt name email"
  );

  if (process.env.DEBUG_AUTH === "1") {
    console.log("[login-otp] mongo.db:", mongoose.connection?.name);
    console.log("[login-otp] iamUser.collection:", IamUser.collection?.name);
    console.log("[login-otp] email(normalized):", email);
    console.log("[login-otp] user found:", !!user);
    console.log("[login-otp] provider:", user?.provider);
    console.log("[login-otp] user id:", user?._id ? String(user._id) : null);
  }

  if (!user) {
    await logIamEvent(req, {
      accion: "LOGIN_OTP_INTENTO",
      entidad: "IamUser",
      titulo: "Usuario no encontrado en login OTP",
      descripcion: `Se intentó iniciar sesión con el correo ${email}, pero no existe usuario.`,
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-login",
      nombre: email,
      actorEmail: email,
    });

    return res.status(404).json({ ok: false, error: "user_not_found" });
  }

  if (user.active === false) {
    await logIamEvent(req, {
      accion: "LOGIN_OTP_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Usuario inactivo en login OTP",
      descripcion: `El usuario ${user.email} intentó iniciar sesión, pero está inactivo.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-login",
      nombre: user.name || user.email,
    });

    return res.status(403).json({ ok: false, error: "user_inactive" });
  }

  const provider = normProvider(user.provider);
  if (provider !== "local") {
    await logIamEvent(req, {
      accion: "LOGIN_OTP_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Login OTP rechazado por provider",
      descripcion: `El usuario ${user.email} no pertenece al provider local.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-login",
      nombre: user.name || user.email,
      meta: { provider },
    });

    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  if (!user.passwordHash) {
    await logIamEvent(req, {
      accion: "LOGIN_OTP_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Login OTP rechazado sin password",
      descripcion: `El usuario ${user.email} no tiene contraseña configurada.`,
      estado: "Denegado",
      prioridad: "Alta",
      source: "iam-login",
      nombre: user.name || user.email,
    });

    return res.status(403).json({ ok: false, error: "password_not_set" });
  }

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) {
    await logIamEvent(req, {
      accion: "LOGIN_OTP_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Credenciales inválidas",
      descripcion: `El usuario ${user.email} ingresó una contraseña incorrecta.`,
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-login",
      nombre: user.name || user.email,
    });

    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }

  const isVisitor = hasRole(user, "visita");
  const otpEnabled = !!settings?.features?.enableEmployeeOtp;

  const firstTimeOtp = !user.otpVerifiedAt;
  const mustChange = isVisitor
    ? false
    : !!user.mustChangePassword || isPasswordExpired(user);

  if (!otpEnabled) {
    const token = signLocalJwt({
      sub: `local|${user._id}`,
      email: user.email,
      name: user.name || user.email,
      provider: "local",
    });

    await logIamEvent(req, {
      accion: "LOGIN",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Login exitoso sin OTP",
      descripcion: `El usuario ${user.email} inició sesión correctamente sin OTP.`,
      estado: "Exitoso",
      prioridad: "Baja",
      source: "iam-login",
      nombre: user.name || user.email,
      after: {
        email: user.email,
        mustChangePassword: mustChange,
        otpRequired: false,
      },
    });

    return res.json({
      ok: true,
      otpRequired: false,
      token,
      mustChangePassword: mustChange,
    });
  }

  const otpRequired = isVisitor ? firstTimeOtp : firstTimeOtp || mustChange;

  if (!otpRequired) {
    const token = signLocalJwt({
      sub: `local|${user._id}`,
      email: user.email,
      name: user.name || user.email,
      provider: "local",
    });

    await logIamEvent(req, {
      accion: "LOGIN",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Login exitoso",
      descripcion: `El usuario ${user.email} inició sesión correctamente.`,
      estado: "Exitoso",
      prioridad: "Baja",
      source: "iam-login",
      nombre: user.name || user.email,
      after: {
        email: user.email,
        mustChangePassword: false,
        otpRequired: false,
      },
    });

    return res.json({
      ok: true,
      otpRequired: false,
      token,
      mustChangePassword: false,
    });
  }

  const purpose = isVisitor ? "visitor-login" : "employee-login";

  const issued = await getOrCreateActiveOtpForLogin({
    email,
    purpose,
    ttlSeconds: settings.ttlSeconds,
    maxAttempts: settings.maxAttempts,
    resendCooldownSeconds: settings.resendCooldownSeconds,
    metaUserId: user._id,
  });

  if (!issued?.ok && issued?.cooldown) {
    await logIamEvent(req, {
      accion: "OTP_COOLDOWN",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "OTP bloqueado por cooldown",
      descripcion: `El usuario ${user.email} intentó reenviar/generar OTP antes del cooldown.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: {
        cooldownSecondsRemaining: secondsRemaining(issued.resendAfter),
        purpose,
      },
    });

    return res.status(429).json({
      ok: false,
      error: "otp_resend_cooldown",
      cooldownSecondsRemaining: secondsRemaining(issued.resendAfter),
    });
  }

  if (issued?.reused) {
    await logIamEvent(req, {
      accion: "OTP_REUTILIZADO",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "OTP activo reutilizado",
      descripcion: `Se reutilizó un OTP activo para el usuario ${user.email}.`,
      estado: "Exitoso",
      prioridad: "Baja",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: {
        purpose,
        expiresAt: issued.expiresAt || null,
        resendAfter: issued.resendAfter || null,
      },
    });

    return res.json({
      ok: true,
      otpRequired: true,
      sentTo: maskEmail(email),
      ttlSeconds: settings.ttlSeconds,
      resendCooldownSeconds: settings.resendCooldownSeconds,
      mustChangePassword: mustChange,
      reusedOtp: true,
    });
  }

  const { code } = issued;

  const mail = await sendOtpEmail({ to: email, code, purpose });
  if (mail?.ok === false) {
    await logIamEvent(req, {
      accion: "OTP_ENVIO_ERROR",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "Error enviando OTP",
      descripcion: `No se pudo enviar el OTP al usuario ${user.email}.`,
      estado: "Fallido",
      prioridad: "Alta",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: {
        purpose,
        mailError: mail.error || "mail_send_failed",
        mailMessage: mail.message || "",
      },
    });

    return res.status(502).json({
      ok: false,
      error: mail.error || "mail_send_failed",
      message: mail.message,
    });
  }

  await logIamEvent(req, {
    accion: "OTP_ENVIADO",
    entidad: "AuthOtp",
    entidadId: String(user._id),
    user,
    titulo: "OTP enviado",
    descripcion: `Se envió OTP al usuario ${user.email} para validación.`,
    estado: "Exitoso",
    prioridad: "Baja",
    source: "iam-otp",
    nombre: user.name || user.email,
    meta: {
      purpose,
      sentTo: maskEmail(email),
      ttlSeconds: settings.ttlSeconds,
      resendCooldownSeconds: settings.resendCooldownSeconds,
      mustChangePassword: mustChange,
    },
  });

  return res.json({
    ok: true,
    otpRequired: true,
    sentTo: maskEmail(email),
    ttlSeconds: settings.ttlSeconds,
    resendCooldownSeconds: settings.resendCooldownSeconds,
    mustChangePassword: mustChange,
  });
}

async function resendOtpHandler(req, res) {
  const settings = getOtpSettings();

  if (!settings?.features?.enableEmployeeOtp) {
    await logIamEvent(req, {
      accion: "OTP_RESEND_INTENTO",
      entidad: "AuthOtp",
      titulo: "OTP deshabilitado",
      descripcion: "Se intentó reenviar OTP cuando la función está deshabilitada.",
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      actorEmail: normEmail(req.body?.email || ""),
      nombre: normEmail(req.body?.email || ""),
    });

    return res
      .status(403)
      .json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ ok: false, error: "email_required" });
  }

  const user = await findIamUserByEmail(
    email,
    "_id email roles +active +provider name"
  );

  if (!user) return res.json({ ok: true });

  if (user.active === false) {
    await logIamEvent(req, {
      accion: "OTP_RESEND_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Reenvío OTP rechazado por usuario inactivo",
      descripcion: `El usuario ${user.email} está inactivo.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
    });

    return res.status(403).json({ ok: false, error: "user_inactive" });
  }

  const provider = normProvider(user.provider);
  if (provider !== "local") {
    await logIamEvent(req, {
      accion: "OTP_RESEND_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Reenvío OTP rechazado por provider",
      descripcion: `El usuario ${user.email} no pertenece al provider local.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: { provider },
    });

    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  const isVisitor = hasRole(user, "visita");
  const purpose = isVisitor ? "visitor-login" : "employee-login";

  const issued = await createOrReplaceActiveOtpDocAtomic({
    email,
    purpose,
    ttlSeconds: settings.ttlSeconds,
    maxAttempts: settings.maxAttempts,
    resendCooldownSeconds: settings.resendCooldownSeconds,
    metaUserId: user._id,
  });

  if (!issued?.ok && issued?.cooldown) {
    await logIamEvent(req, {
      accion: "OTP_COOLDOWN",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "Reenvío OTP bloqueado por cooldown",
      descripcion: `El usuario ${user.email} intentó reenviar OTP antes del cooldown.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: {
        purpose,
        cooldownSecondsRemaining: secondsRemaining(issued.resendAfter),
      },
    });

    return res.status(429).json({
      ok: false,
      error: "otp_resend_cooldown",
      cooldownSecondsRemaining: secondsRemaining(issued.resendAfter),
    });
  }

  const { code } = issued;

  const mail = await sendOtpEmail({ to: email, code, purpose });
  if (mail?.ok === false) {
    await logIamEvent(req, {
      accion: "OTP_ENVIO_ERROR",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "Error reenviando OTP",
      descripcion: `No se pudo reenviar el OTP al usuario ${user.email}.`,
      estado: "Fallido",
      prioridad: "Alta",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: {
        purpose,
        mailError: mail.error || "mail_send_failed",
        mailMessage: mail.message || "",
      },
    });

    return res.status(502).json({
      ok: false,
      error: mail.error || "mail_send_failed",
      message: mail.message,
    });
  }

  await logIamEvent(req, {
    accion: "OTP_REENVIADO",
    entidad: "AuthOtp",
    entidadId: String(user._id),
    user,
    titulo: "OTP reenviado",
    descripcion: `Se reenviò OTP al usuario ${user.email}.`,
    estado: "Exitoso",
    prioridad: "Baja",
    source: "iam-otp",
    nombre: user.name || user.email,
    meta: {
      purpose,
      sentTo: maskEmail(email),
    },
  });

  return res.json({ ok: true, sentTo: maskEmail(email) });
}

async function verifyOtpHandler(req, res) {
  const settings = getOtpSettings();

  if (!settings?.features?.enableEmployeeOtp) {
    await logIamEvent(req, {
      accion: "OTP_VERIFY_INTENTO",
      entidad: "AuthOtp",
      titulo: "Validación OTP deshabilitada",
      descripcion: "Se intentó verificar OTP cuando la función está deshabilitada.",
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      actorEmail: normEmail(req.body?.email || ""),
      nombre: normEmail(req.body?.email || ""),
    });

    return res
      .status(403)
      .json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  const otp = String(req.body?.otp || req.body?.code || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ ok: false, error: "email_and_otp_required" });
  }

  const user = await findIamUserByEmail(
    email,
    "email name roles +active +provider mustChangePassword passwordExpiresAt otpVerifiedAt"
  );

  if (!user) {
    await logIamEvent(req, {
      accion: "OTP_VERIFY_INTENTO",
      entidad: "IamUser",
      titulo: "Usuario no encontrado al validar OTP",
      descripcion: `No existe usuario para el correo ${email}.`,
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-otp",
      actorEmail: email,
      nombre: email,
    });

    return res.status(404).json({ ok: false, error: "user_not_found" });
  }

  if (user.active === false) {
    await logIamEvent(req, {
      accion: "OTP_VERIFY_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Validación OTP rechazada por usuario inactivo",
      descripcion: `El usuario ${user.email} está inactivo.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
    });

    return res.status(403).json({ ok: false, error: "user_inactive" });
  }

  const provider = normProvider(user.provider);
  if (provider !== "local") {
    await logIamEvent(req, {
      accion: "OTP_VERIFY_INTENTO",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Validación OTP rechazada por provider",
      descripcion: `El usuario ${user.email} no pertenece al provider local.`,
      estado: "Denegado",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: { provider },
    });

    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  const isVisitor = hasRole(user, "visita");
  const purpose = isVisitor ? "visitor-login" : "employee-login";

  const doc = await getActiveOtp(email, purpose);
  if (!doc) {
    await expireActiveOtps(email, purpose).catch(() => {});

    await logIamEvent(req, {
      accion: "OTP_INVALIDO",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "OTP no encontrado",
      descripcion: `No se encontró OTP activo para el usuario ${user.email}.`,
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: { purpose },
    });

    return res.status(400).json({ ok: false, error: "otp_not_found" });
  }

  if (isExpiredDoc(doc)) {
    await doc.markExpired?.().catch(async () => {
      doc.status = "expired";
      await doc.save().catch(() => {});
    });

    await logIamEvent(req, {
      accion: "OTP_EXPIRADO",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "OTP expirado",
      descripcion: `El OTP del usuario ${user.email} ya expiró.`,
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: { purpose },
    });

    return res.status(400).json({ ok: false, error: "otp_expired" });
  }

  const maxAttempts = Number.isFinite(Number(doc.maxAttempts))
    ? Number(doc.maxAttempts)
    : settings.maxAttempts;

  if (Number(doc.attempts || 0) >= maxAttempts) {
    await doc.markConsumed?.().catch(async () => {
      doc.consumedAt = new Date();
      doc.status = "consumed";
      await doc.save().catch(() => {});
    });

    await logIamEvent(req, {
      accion: "OTP_MAX_ATTEMPTS",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "OTP bloqueado por intentos máximos",
      descripcion: `El usuario ${user.email} excedió los intentos permitidos del OTP.`,
      estado: "Bloqueado",
      prioridad: "Alta",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: { purpose, maxAttempts },
    });

    return res.status(429).json({ ok: false, error: "otp_max_attempts" });
  }

  const expectedHash = hashOtp(email, otp);

  if (expectedHash !== String(doc.codeHash || "")) {
    doc.attempts = Number(doc.attempts || 0) + 1;

    if (doc.attempts >= maxAttempts) {
      doc.consumedAt = new Date();
      doc.status = "consumed";
    }

    await doc.save().catch(() => {});

    await logIamEvent(req, {
      accion: "OTP_INVALIDO",
      entidad: "AuthOtp",
      entidadId: String(user._id),
      user,
      titulo: "OTP inválido",
      descripcion: `El usuario ${user.email} ingresó un OTP inválido.`,
      estado: "Fallido",
      prioridad: "Media",
      source: "iam-otp",
      nombre: user.name || user.email,
      meta: {
        purpose,
        attempts: doc.attempts,
        maxAttempts,
      },
    });

    return res.status(401).json({ ok: false, error: "otp_invalid" });
  }

  await doc.markConsumed?.().catch(async () => {
    doc.consumedAt = new Date();
    doc.status = "consumed";
    await doc.save().catch(() => {});
  });

  if (!user.otpVerifiedAt) {
    user.otpVerifiedAt = new Date();
    await user.save().catch(() => {});
  }

  await logIamEvent(req, {
    accion: "OTP_VALIDADO",
    entidad: "AuthOtp",
    entidadId: String(user._id),
    user,
    titulo: "OTP validado correctamente",
    descripcion: `El usuario ${user.email} validó correctamente su OTP.`,
    estado: "Exitoso",
    prioridad: "Baja",
    source: "iam-otp",
    nombre: user.name || user.email,
    meta: { purpose },
  });

  const mustChange = isVisitor
    ? false
    : !!user.mustChangePassword || isPasswordExpired(user);

  if (mustChange) {
    const resetToken = signPwResetToken({ email: user.email, userId: user._id });

    await logIamEvent(req, {
      accion: "PASSWORD_RESET_REQUIRED",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Cambio de contraseña requerido",
      descripcion: `El usuario ${user.email} debe cambiar su contraseña tras validar OTP.`,
      estado: "Pendiente",
      prioridad: "Media",
      source: "iam-password",
      nombre: user.name || user.email,
    });

    return res.json({ ok: true, mustChangePassword: true, resetToken });
  }

  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
  });

  await logIamEvent(req, {
    accion: "LOGIN",
    entidad: "IamUser",
    entidadId: String(user._id),
    user,
    titulo: "Login exitoso con OTP",
    descripcion: `El usuario ${user.email} inició sesión correctamente tras validar OTP.`,
    estado: "Exitoso",
    prioridad: "Baja",
    source: "iam-login",
    nombre: user.name || user.email,
    after: {
      email: user.email,
      otpValidated: true,
      mustChangePassword: false,
    },
  });

  return res.json({ ok: true, token, mustChangePassword: false });
}

async function resetPasswordOtpHandler(req, res) {
  const email = normEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  const s = getSecuritySettings?.() || {};
  const minLength = Number.isFinite(Number(s?.password?.minLength))
    ? Number(s.password.minLength)
    : 8;

  if (newPassword.length < minLength) {
    return res
      .status(400)
      .json({ ok: false, error: "password_too_short", minLength });
  }

  let decoded;
  try {
    decoded = verifyPwResetToken(resetToken);
  } catch {
    await logIamEvent(req, {
      accion: "PASSWORD_RESET_OTP",
      entidad: "IamUser",
      titulo: "Reset password token inválido",
      descripcion: `Intento de cambio de contraseña con token inválido para ${email}.`,
      estado: "Fallido",
      prioridad: "Alta",
      source: "iam-password",
      actorEmail: email,
      nombre: email,
    });

    return res
      .status(401)
      .json({ ok: false, error: "reset_token_invalid_or_expired" });
  }

  if (normEmail(decoded?.email) !== email) {
    await logIamEvent(req, {
      accion: "PASSWORD_RESET_OTP",
      entidad: "IamUser",
      titulo: "Reset token no coincide con email",
      descripcion: `El token de reset no coincide con el correo ${email}.`,
      estado: "Fallido",
      prioridad: "Alta",
      source: "iam-password",
      actorEmail: email,
      nombre: email,
    });

    return res
      .status(401)
      .json({ ok: false, error: "reset_token_email_mismatch" });
  }

  const user = await findIamUserByEmail(
    email,
    "+passwordHash roles +active +provider mustChangePassword passwordExpiresAt name email"
  );

  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
  if (hasRole(user, "visita")) {
    return res
      .status(403)
      .json({ ok: false, error: "visitor_reset_not_allowed" });
  }
  if (user.active === false) {
    return res.status(403).json({ ok: false, error: "user_inactive" });
  }

  const provider = normProvider(user.provider);
  if (provider !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  if (String(user._id) !== String(decoded?.uid)) {
    await logIamEvent(req, {
      accion: "PASSWORD_RESET_OTP",
      entidad: "IamUser",
      entidadId: String(user._id),
      user,
      titulo: "Reset token no coincide con usuario",
      descripcion: `El token de reset no coincide con el usuario ${user.email}.`,
      estado: "Fallido",
      prioridad: "Alta",
      source: "iam-password",
      nombre: user.name || user.email,
    });

    return res
      .status(401)
      .json({ ok: false, error: "reset_token_user_mismatch" });
  }

  const before = {
    mustChangePassword: !!user.mustChangePassword,
    passwordExpiresAt: user.passwordExpiresAt || null,
  };

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  const expiresDays = Number.isFinite(Number(s?.password?.expiresDays))
    ? Number(s.password.expiresDays)
    : 0;
  user.passwordExpiresAt =
    expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;

  await user.save();

  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
  });

  await logIamEvent(req, {
    accion: "PASSWORD_RESET_OTP",
    entidad: "IamUser",
    entidadId: String(user._id),
    user,
    titulo: "Contraseña restablecida por OTP",
    descripcion: `El usuario ${user.email} restableció su contraseña correctamente.`,
    estado: "Exitoso",
    prioridad: "Media",
    source: "iam-password",
    nombre: user.name || user.email,
    before,
    after: {
      mustChangePassword: !!user.mustChangePassword,
      passwordExpiresAt: user.passwordExpiresAt || null,
      passwordChangedAt: user.passwordChangedAt || null,
    },
  });

  return res.json({ ok: true, token, mustChangePassword: false });
}

async function changePasswordHandler(req, res) {
  const email = normEmail(req.body?.email);
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !newPassword) {
    return res
      .status(400)
      .json({ ok: false, error: "email_and_newPassword_required" });
  }

  const s = getSecuritySettings?.() || {};
  const minLength = Number.isFinite(Number(s?.password?.minLength))
    ? Number(s.password.minLength)
    : 8;

  if (newPassword.length < minLength) {
    return res
      .status(400)
      .json({ ok: false, error: "password_too_short", minLength });
  }

  const user = await findIamUserByEmail(
    email,
    "+passwordHash roles +active +provider mustChangePassword passwordExpiresAt name email"
  );

  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
  if (hasRole(user, "visita")) {
    return res
      .status(403)
      .json({ ok: false, error: "visitor_change_not_allowed" });
  }
  if (user.active === false) {
    return res.status(403).json({ ok: false, error: "user_inactive" });
  }

  const provider = normProvider(user.provider);
  if (provider !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  const before = {
    mustChangePassword: !!user.mustChangePassword,
    passwordExpiresAt: user.passwordExpiresAt || null,
  };

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  const expiresDays = Number.isFinite(Number(s?.password?.expiresDays))
    ? Number(s.password.expiresDays)
    : 0;
  user.passwordExpiresAt =
    expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;

  await user.save();

  await logIamEvent(req, {
    accion: "PASSWORD_CHANGE",
    entidad: "IamUser",
    entidadId: String(user._id),
    user,
    titulo: "Contraseña cambiada",
    descripcion: `El usuario ${user.email} cambió su contraseña correctamente.`,
    estado: "Exitoso",
    prioridad: "Media",
    source: "iam-password",
    nombre: user.name || user.email,
    before,
    after: {
      mustChangePassword: !!user.mustChangePassword,
      passwordExpiresAt: user.passwordExpiresAt || null,
      passwordChangedAt: user.passwordChangedAt || null,
    },
  });

  return res.json({ ok: true });
}

/* =========================================================
   Rutas
========================================================= */
r.post("/login-otp", loginOtpHandler);
r.post("/verify-otp", verifyOtpHandler);
r.post("/resend-otp", resendOtpHandler);
r.post("/reset-password-otp", resetPasswordOtpHandler);
r.post("/change-password", changePasswordHandler);

// Aliases
r.post("/auth/login-otp", loginOtpHandler);
r.post("/auth/verify-otp", verifyOtpHandler);
r.post("/auth/resend-otp", resendOtpHandler);
r.post("/auth/reset-password-otp", resetPasswordOtpHandler);
r.post("/auth/change-password", changePasswordHandler);

export default r;