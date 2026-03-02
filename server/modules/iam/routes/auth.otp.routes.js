// server/modules/iam/routes/auth.otp.routes.js
import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import IamUser from "../models/IamUser.model.js";
import AuthOtp from "../models/AuthOtp.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import { getSecuritySettings } from "../services/settings.service.js";

// ✅ Mail OTP centralizado (usa server/src/core/mailer/mailer.js)
import { sendOtpEmail } from "../services/otp.mailer.js";

const r = Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ---------------------- helpers ---------------------- */
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

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
  return {
    ttlSeconds: Number.isFinite(Number(otp.ttlSeconds)) ? Number(otp.ttlSeconds) : 300,
    maxAttempts: Number.isFinite(Number(otp.maxAttempts)) ? Number(otp.maxAttempts) : 5,
    resendCooldownSeconds: Number.isFinite(Number(otp.resendCooldownSeconds))
      ? Number(otp.resendCooldownSeconds)
      : 30,
    features: s.features || {},
    password: s.password || {},
  };
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

function randomOtp6() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function hasRole(user, role) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.map((x) => String(x).toLowerCase()).includes(String(role).toLowerCase());
}

function isPasswordExpired(user) {
  if (!user?.passwordExpiresAt) return false;
  const d = new Date(user.passwordExpiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return new Date() > d;
}

/* ---------------------- Reset token (pwreset) ---------------------- */
function signPwResetToken({ email, userId }) {
  const secret = jwtSecret();
  const payload = {
    typ: "pwreset",
    email: normEmail(email),
    uid: String(userId),
  };
  const expMinutes = envNum("PWRESET_TOKEN_TTL_MINUTES", 10);
  return jwt.sign(payload, secret, { expiresIn: `${expMinutes}m`, algorithm: "HS256" });
}

function verifyPwResetToken(token) {
  const secret = jwtSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (!decoded || decoded.typ !== "pwreset") throw new Error("invalid_pwreset_token");
  return decoded;
}

/* =========================================================
  ✅ OTP en Mongo (AuthOtp)
========================================================= */

async function getActiveOtp(email, purpose) {
  return AuthOtp.findOne({
    email,
    purpose,
    consumedAt: null,
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
 * Crea o reemplaza OTP activo de forma ATÓMICA.
 * - Evita carreras (concurrencia) y E11000 por índice único parcial.
 */
async function createOrReplaceActiveOtpDoc({
  email,
  purpose,
  ttlSeconds,
  maxAttempts,
  resendCooldownSeconds,
  metaUserId,
}) {
  const code = randomOtp6();
  const codeHash = sha256(code);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + Number(ttlSeconds || 300) * 1000);
  const resendAfter = new Date(now.getTime() + Number(resendCooldownSeconds || 30) * 1000);

  const update = {
    $set: {
      codeHash,
      expiresAt,
      resendAfter,
      attempts: 0,
      maxAttempts: Number(maxAttempts || 5),
      consumedAt: null,
      meta: { userId: metaUserId || null },
    },
    $setOnInsert: {
      email,
      purpose,
    },
  };

  try {
    await AuthOtp.findOneAndUpdate(
      { email, purpose, consumedAt: null },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
  } catch (e) {
    const msg = String(e?.message || "");
    if (e?.code === 11000 || msg.includes("E11000")) {
      await AuthOtp.updateMany(
        { email, purpose, consumedAt: null },
        { $set: { consumedAt: new Date() } }
      ).exec();

      await AuthOtp.create({
        email,
        purpose,
        codeHash,
        expiresAt,
        resendAfter,
        attempts: 0,
        maxAttempts: Number(maxAttempts || 5),
        consumedAt: null,
        meta: { userId: metaUserId || null },
      });
    } else {
      throw e;
    }
  }

  return { code, expiresAt, resendAfter };
}

/* =========================
  Handlers reutilizables
========================= */

async function loginOtpHandler(req, res) {
  const settings = getOtpSettings();

  const email = normEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email_and_password_required" });
  }

  const user = await IamUser.findOne({ email })
    .select("+passwordHash roles +active +provider mustChangePassword otpVerifiedAt passwordExpiresAt name email")
    .exec();

  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  if (String(user.provider || "").toLowerCase() !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  if (!user.passwordHash) {
    return res.status(403).json({
      ok: false,
      error: "password_not_set",
      message: "Este usuario no tiene contraseña configurada. Contacta al administrador o restablece.",
    });
  }

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) return res.status(401).json({ ok: false, error: "invalid_credentials" });

  const isVisitor = hasRole(user, "visita");
  const otpEnabled = !!settings?.features?.enableEmployeeOtp;

  const firstTimeOtp = !user.otpVerifiedAt;
  const mustChange = isVisitor ? false : (!!user.mustChangePassword || isPasswordExpired(user));

  // OTP OFF => token directo
  if (!otpEnabled) {
    const token = signLocalJwt({
      sub: `local|${user._id}`,
      email: user.email,
      name: user.name || user.email,
      provider: "local",
    });

    return res.json({
      ok: true,
      otpRequired: false,
      token,
      mustChangePassword: mustChange,
    });
  }

  const otpRequired = isVisitor ? firstTimeOtp : (firstTimeOtp || mustChange);

  if (!otpRequired) {
    const token = signLocalJwt({
      sub: `local|${user._id}`,
      email: user.email,
      name: user.name || user.email,
      provider: "local",
    });

    return res.json({
      ok: true,
      otpRequired: false,
      token,
      mustChangePassword: false,
    });
  }

  const purpose = isVisitor ? "visitor-login" : "employee-login";

  const existing = await getActiveOtp(email, purpose);
  if (existing && !isExpiredDoc(existing) && !canResendDoc(existing)) {
    return res.status(429).json({
      ok: false,
      error: "otp_resend_cooldown",
      cooldownSeconds: settings.resendCooldownSeconds,
      message: `Espera ${settings.resendCooldownSeconds}s para reenviar.`,
    });
  }

  const { code } = await createOrReplaceActiveOtpDoc({
    email,
    purpose,
    ttlSeconds: settings.ttlSeconds,
    maxAttempts: settings.maxAttempts,
    resendCooldownSeconds: settings.resendCooldownSeconds,
    metaUserId: user._id,
  });

  // ✅ Envío centralizado
  const mail = await sendOtpEmail({ to: email, code, purpose });
  if (mail?.ok === false) {
    return res.status(502).json({
      ok: false,
      error: mail.error || "mail_send_failed",
      message: mail?.message || "No se pudo enviar el correo OTP.",
    });
  }

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
    return res.status(403).json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  if (!email) return res.status(400).json({ ok: false, error: "email_required" });

  const user = await IamUser.findOne({ email })
    .select("_id email roles +active +provider name")
    .exec();

  if (!user || user.active === false || String(user.provider || "").toLowerCase() !== "local") {
    return res.json({ ok: true }); // no revelar
  }

  const isVisitor = hasRole(user, "visita");
  const purpose = isVisitor ? "visitor-login" : "employee-login";

  const existing = await getActiveOtp(email, purpose);
  if (existing && !isExpiredDoc(existing) && !canResendDoc(existing)) {
    return res.status(429).json({
      ok: false,
      error: "otp_resend_cooldown",
      cooldownSeconds: settings.resendCooldownSeconds,
      message: `Espera ${settings.resendCooldownSeconds}s para reenviar.`,
    });
  }

  const { code } = await createOrReplaceActiveOtpDoc({
    email,
    purpose,
    ttlSeconds: settings.ttlSeconds,
    maxAttempts: settings.maxAttempts,
    resendCooldownSeconds: settings.resendCooldownSeconds,
    metaUserId: user._id,
  });

  // ✅ Envío centralizado
  const mail = await sendOtpEmail({ to: email, code, purpose });
  if (mail?.ok === false) {
    return res.status(502).json({
      ok: false,
      error: mail.error || "mail_send_failed",
      message: mail?.message || "No se pudo enviar el correo OTP.",
    });
  }

  return res.json({
    ok: true,
    sentTo: maskEmail(email),
    ttlSeconds: settings.ttlSeconds,
    resendCooldownSeconds: settings.resendCooldownSeconds,
  });
}

async function verifyOtpHandler(req, res) {
  const settings = getOtpSettings();
  if (!settings?.features?.enableEmployeeOtp) {
    return res.status(403).json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ ok: false, error: "email_and_otp_required" });
  }

  let doc = await getActiveOtp(email, "visitor-login");
  if (!doc) doc = await getActiveOtp(email, "employee-login");
  if (!doc) return res.status(400).json({ ok: false, error: "otp_not_found" });

  if (isExpiredDoc(doc)) {
    await doc.consume().catch(() => {});
    return res.status(400).json({ ok: false, error: "otp_expired" });
  }

  const maxAttempts = Number.isFinite(Number(doc.maxAttempts))
    ? Number(doc.maxAttempts)
    : settings.maxAttempts;

  if (Number(doc.attempts || 0) >= maxAttempts) {
    await doc.consume().catch(() => {});
    return res.status(429).json({ ok: false, error: "otp_max_attempts" });
  }

  doc.attempts = Number(doc.attempts || 0) + 1;
  await doc.save();

  if (sha256(otp) !== String(doc.codeHash || "")) {
    return res.status(401).json({ ok: false, error: "otp_invalid" });
  }

  await doc.consume().catch(() => {});

  const user = await IamUser.findOne({ email }).exec();
  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

  if (!user.otpVerifiedAt) {
    user.otpVerifiedAt = new Date();
    try {
      await user.save();
    } catch (e) {
      console.warn("[otp] could not persist otpVerifiedAt:", e?.message || e);
    }
  }

  const isVisitor = hasRole(user, "visita");
  const mustChange = isVisitor ? false : (!!user.mustChangePassword || isPasswordExpired(user));

  if (mustChange) {
    const resetToken = signPwResetToken({ email: user.email, userId: user._id });
    return res.json({
      ok: true,
      mustChangePassword: true,
      resetToken,
    });
  }

  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
  });

  return res.json({
    ok: true,
    token,
    mustChangePassword: false,
  });
}

async function resetPasswordOtpHandler(req, res) {
  const email = normEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  const s = getSecuritySettings?.() || {};
  const minLength = Number.isFinite(Number(s?.password?.minLength)) ? Number(s.password.minLength) : 8;

  if (newPassword.length < minLength) {
    return res.status(400).json({ ok: false, error: "password_too_short", minLength });
  }

  let decoded;
  try {
    decoded = verifyPwResetToken(resetToken);
  } catch {
    return res.status(401).json({ ok: false, error: "reset_token_invalid_or_expired" });
  }

  if (normEmail(decoded?.email) !== email) {
    return res.status(401).json({ ok: false, error: "reset_token_email_mismatch" });
  }

  const user = await IamUser.findOne({ email })
    .select("+passwordHash roles +active +provider mustChangePassword passwordExpiresAt name email")
    .exec();

  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

  if (hasRole(user, "visita")) {
    return res.status(403).json({ ok: false, error: "visitor_reset_not_allowed" });
  }

  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  if (String(user.provider || "").toLowerCase() !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  if (String(user._id) !== String(decoded?.uid)) {
    return res.status(401).json({ ok: false, error: "reset_token_user_mismatch" });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  const expiresDays = Number.isFinite(Number(s?.password?.expiresDays)) ? Number(s.password.expiresDays) : 0;
  user.passwordExpiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;

  await user.save();

  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
  });

  return res.json({ ok: true, token, mustChangePassword: false });
}

async function changePasswordHandler(req, res) {
  const email = normEmail(req.body?.email);
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !newPassword) {
    return res.status(400).json({ ok: false, error: "email_and_newPassword_required" });
  }

  const s = getSecuritySettings?.() || {};
  const minLength = Number.isFinite(Number(s?.password?.minLength)) ? Number(s.password.minLength) : 8;

  if (newPassword.length < minLength) {
    return res.status(400).json({ ok: false, error: "password_too_short", minLength });
  }

  const user = await IamUser.findOne({ email }).select("+passwordHash roles +active +provider").exec();
  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

  if (hasRole(user, "visita")) {
    return res.status(403).json({ ok: false, error: "visitor_change_not_allowed" });
  }

  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  if (String(user.provider || "").toLowerCase() !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  const expiresDays = Number.isFinite(Number(s?.password?.expiresDays)) ? Number(s.password.expiresDays) : 0;
  user.passwordExpiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;

  await user.save();

  return res.json({ ok: true });
}

/* =========================================================
  Rutas principales
========================================================= */
r.post("/login-otp", loginOtpHandler);
r.post("/verify-otp", verifyOtpHandler);
r.post("/resend-otp", resendOtpHandler);
r.post("/reset-password-otp", resetPasswordOtpHandler);
r.post("/change-password", changePasswordHandler);

/* =========================================================
  Aliases
========================================================= */
r.post("/auth/login-otp", loginOtpHandler);
r.post("/auth/verify-otp", verifyOtpHandler);
r.post("/auth/resend-otp", resendOtpHandler);
r.post("/auth/reset-password-otp", resetPasswordOtpHandler);
r.post("/auth/change-password", changePasswordHandler);

export default r;