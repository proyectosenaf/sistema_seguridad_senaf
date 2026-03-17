// server/modules/iam/routes/auth.otp.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import IamUser from "../models/IamUser.model.js";
import AuthOtp from "../models/AuthOtp.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import { getSecuritySettings } from "../services/settings.service.js";
import { sendOtpEmail } from "../services/otp.mailer.js";
import { normEmail, makeOtp, hashOtp } from "../utils/otp.util.js";

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

function secondsRemaining(dateObj) {
  if (!dateObj) return 0;
  const t = new Date(dateObj).getTime();
  if (!Number.isFinite(t)) return 0;
  const diffMs = t - Date.now();
  return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
}

/* ---------------------- Reset token (pwreset) ---------------------- */
function signPwResetToken({ email, userId }) {
  const secret = jwtSecret();
  const payload = { typ: "pwreset", email: normEmail(email), uid: String(userId) };
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
  const resendAfter = new Date(now.getTime() + Number(resendCooldownSeconds || 30) * 1000);

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
    return res.status(400).json({ ok: false, error: "email_and_password_required" });
  }

  const user = await IamUser.findOne({ email })
    .select("+passwordHash roles +active +provider mustChangePassword otpVerifiedAt passwordExpiresAt name email")
    .exec();

  if (process.env.DEBUG_AUTH === "1") {
    console.log("[login-otp] mongo.db:", mongoose.connection?.name);
    console.log("[login-otp] iamUser.collection:", IamUser.collection?.name);
    console.log("[login-otp] email:", email, "provider:", user?.provider);
  }

  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  const provider = normProvider(user.provider);
  if (provider !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  if (!user.passwordHash) return res.status(403).json({ ok: false, error: "password_not_set" });

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) return res.status(401).json({ ok: false, error: "invalid_credentials" });

  const isVisitor = hasRole(user, "visita");
  const otpEnabled = !!settings?.features?.enableEmployeeOtp;

  const firstTimeOtp = !user.otpVerifiedAt;
  const mustChange = isVisitor ? false : !!user.mustChangePassword || isPasswordExpired(user);

  if (!otpEnabled) {
    const token = signLocalJwt({
      sub: `local|${user._id}`,
      email: user.email,
      name: user.name || user.email,
      provider: "local",
    });
    return res.json({ ok: true, otpRequired: false, token, mustChangePassword: mustChange });
  }

  const otpRequired = isVisitor ? firstTimeOtp : firstTimeOtp || mustChange;

  if (!otpRequired) {
    const token = signLocalJwt({
      sub: `local|${user._id}`,
      email: user.email,
      name: user.name || user.email,
      provider: "local",
    });
    return res.json({ ok: true, otpRequired: false, token, mustChangePassword: false });
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
    return res.status(429).json({
      ok: false,
      error: "otp_resend_cooldown",
      cooldownSecondsRemaining: secondsRemaining(issued.resendAfter),
    });
  }

  if (issued?.reused) {
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
    return res.status(502).json({
      ok: false,
      error: mail.error || "mail_send_failed",
      message: mail.message,
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

  if (!user) return res.json({ ok: true });
  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  const provider = normProvider(user.provider);
  if (provider !== "local") return res.status(403).json({ ok: false, error: "not_local_user" });

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
    return res.status(429).json({
      ok: false,
      error: "otp_resend_cooldown",
      cooldownSecondsRemaining: secondsRemaining(issued.resendAfter),
    });
  }

  const { code } = issued;

  const mail = await sendOtpEmail({ to: email, code, purpose });
  if (mail?.ok === false) {
    return res.status(502).json({
      ok: false,
      error: mail.error || "mail_send_failed",
      message: mail.message,
    });
  }

  return res.json({ ok: true, sentTo: maskEmail(email) });
}

async function verifyOtpHandler(req, res) {
  const settings = getOtpSettings();

  if (!settings?.features?.enableEmployeeOtp) {
    return res.status(403).json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  const otp = String(req.body?.otp || req.body?.code || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ ok: false, error: "email_and_otp_required" });
  }

  const user = await IamUser.findOne({ email })
    .select("email name roles +active +provider mustChangePassword passwordExpiresAt otpVerifiedAt")
    .exec();

  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  const provider = normProvider(user.provider);
  if (provider !== "local") return res.status(403).json({ ok: false, error: "not_local_user" });

  const isVisitor = hasRole(user, "visita");
  const purpose = isVisitor ? "visitor-login" : "employee-login";

  const doc = await getActiveOtp(email, purpose);
  if (!doc) {
    await expireActiveOtps(email, purpose).catch(() => {});
    return res.status(400).json({ ok: false, error: "otp_not_found" });
  }

  if (isExpiredDoc(doc)) {
    await doc.markExpired?.().catch(async () => {
      doc.status = "expired";
      await doc.save().catch(() => {});
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

  const mustChange = isVisitor ? false : !!user.mustChangePassword || isPasswordExpired(user);
  if (mustChange) {
    const resetToken = signPwResetToken({ email: user.email, userId: user._id });
    return res.json({ ok: true, mustChangePassword: true, resetToken });
  }

  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
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
  if (hasRole(user, "visita")) return res.status(403).json({ ok: false, error: "visitor_reset_not_allowed" });
  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  const provider = normProvider(user.provider);
  if (provider !== "local") return res.status(403).json({ ok: false, error: "not_local_user" });

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
  if (hasRole(user, "visita")) return res.status(403).json({ ok: false, error: "visitor_change_not_allowed" });
  if (user.active === false) return res.status(403).json({ ok: false, error: "user_inactive" });

  const provider = normProvider(user.provider);
  if (provider !== "local") return res.status(403).json({ ok: false, error: "not_local_user" });

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  const expiresDays = Number.isFinite(Number(s?.password?.expiresDays)) ? Number(s.password.expiresDays) : 0;
  user.passwordExpiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;

  await user.save();
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