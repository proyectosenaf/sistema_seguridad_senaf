// server/modules/iam/routes/auth.otp.routes.js
import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import { getSecuritySettings } from "../services/settings.service.js";

// SMTP simple (si no hay MAIL_* configurado, log en consola en DEV)
import nodemailer from "nodemailer";

const r = Router();

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

function ensureEnv(name) {
  const v = String(process.env[name] || "").trim();
  return v || null;
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

function signLocalJwt(payload) {
  const secret = ensureEnv("JWT_SECRET") || "dev_secret";
  const expiresIn = String(process.env.JWT_EXPIRES_IN || "12h");
  // ✅ fija HS256 explícitamente
  return jwt.sign(payload, secret, { expiresIn, algorithm: "HS256" });
}

function randomOtp6() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

/* ---------------------- mailer (cache) ---------------------- */
let MAIL_TRANSPORT = null;

function makeMailer() {
  if (MAIL_TRANSPORT) return MAIL_TRANSPORT;

  const host = ensureEnv("MAIL_HOST");
  const port = Number(process.env.MAIL_PORT || 587);
  const secure = String(process.env.MAIL_SECURE || "0") === "1";
  const user = ensureEnv("MAIL_USER");
  const pass = ensureEnv("MAIL_PASS");

  if (!host || !user || !pass) return null;

  const rejectUnauthorized = String(process.env.MAIL_TLS_REJECT_UNAUTHORIZED || "1") !== "0";

  MAIL_TRANSPORT = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });

  return MAIL_TRANSPORT;
}

async function sendOtpEmail({ to, code }) {
  const transport = makeMailer();
  if (!transport) {
    console.warn("[otp] MAIL_* no configurado. OTP para", to, "=>", code);
    return { ok: true, dev: true };
  }

  const from = ensureEnv("MAIL_FROM") || ensureEnv("MAIL_USER");
  const appName = ensureEnv("APP_NAME") || "SENAF";

  try {
    await transport.sendMail({
      from,
      to,
      subject: `${appName} — Código de verificación`,
      text: `Tu código de verificación es: ${code}\n\nEste código vence pronto.`,
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>${appName}</h2>
          <p>Tu código de verificación es:</p>
          <div style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</div>
          <p>Este código vence pronto.</p>
        </div>
      `,
    });

    return { ok: true };
  } catch (e) {
    // ✅ no “revienta” el login, pero sí te deja el error claro
    console.error("[otp] sendMail failed:", e?.message || e);
    return { ok: false, error: "mail_send_failed", message: e?.message || String(e) };
  }
}

/* ---------------------- OTP store (memoria) ---------------------- */
const OTP_STORE = new Map();
/**
 * key: email
 * value: { codeHash, exp, attempts, lastSentAt }
 */

function canResend(entry, cooldownSeconds) {
  if (!entry?.lastSentAt) return true;
  return Date.now() - entry.lastSentAt >= cooldownSeconds * 1000;
}

function isExpired(entry) {
  return !entry?.exp || Date.now() > entry.exp;
}

/* =========================
   Handlers reutilizables
   ========================= */
async function loginOtpHandler(req, res) {
  const settings = getOtpSettings();
  if (!settings?.features?.enableEmployeeOtp) {
    return res.status(403).json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email_and_password_required" });
  }

  const user = await IamUser.findOne({ email }).select("+passwordHash").lean();
  if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });
  if (!user.active) return res.status(403).json({ ok: false, error: "user_inactive" });
  if (String(user.provider || "").toLowerCase() !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) return res.status(401).json({ ok: false, error: "invalid_credentials" });

  const existing = OTP_STORE.get(email);
  if (existing && !isExpired(existing)) {
    if (!canResend(existing, settings.resendCooldownSeconds)) {
      return res.status(429).json({
        ok: false,
        error: "otp_resend_cooldown",
        cooldownSeconds: settings.resendCooldownSeconds, // ✅ útil para UI
        message: `Espera ${settings.resendCooldownSeconds}s para reenviar.`,
      });
    }
  }

  const code = randomOtp6();
  OTP_STORE.set(email, {
    codeHash: sha256(code),
    exp: Date.now() + settings.ttlSeconds * 1000,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  const mail = await sendOtpEmail({ to: email, code });
  if (mail?.ok === false) {
    // ✅ si falla correo, te lo digo explícito
    return res.status(502).json({
      ok: false,
      error: "mail_send_failed",
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

  const entry = OTP_STORE.get(email);
  if (!entry) return res.status(400).json({ ok: false, error: "otp_not_found" });

  if (isExpired(entry)) {
    OTP_STORE.delete(email);
    return res.status(400).json({ ok: false, error: "otp_expired" });
  }

  if (entry.attempts >= settings.maxAttempts) {
    OTP_STORE.delete(email);
    return res.status(429).json({ ok: false, error: "otp_max_attempts" });
  }

  entry.attempts += 1;
  OTP_STORE.set(email, entry);

  if (sha256(otp) !== entry.codeHash) {
    return res.status(401).json({ ok: false, error: "otp_invalid" });
  }

  OTP_STORE.delete(email);

  const user = await IamUser.findOne({ email }).lean();
  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

  // mustChangePassword si está marcado o si expiró
  let mustChange = !!user.mustChangePassword;
  if (user.passwordExpiresAt && new Date() > new Date(user.passwordExpiresAt)) mustChange = true;

  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
  });

  return res.json({
    ok: true,
    token,
    mustChangePassword: mustChange,
  });
}

/**
 * ✅ Nota: este endpoint NO debe estar abierto públicamente en producción.
 * Lo dejo porque lo traías, pero lo recomendado es:
 * - reset por link (request-password-reset + reset-password) o
 * - change-password autenticado (Bearer)
 */
async function changePasswordHandler(req, res) {
  const email = normEmail(req.body?.email);
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !newPassword) {
    return res.status(400).json({ ok: false, error: "email_and_newPassword_required" });
  }

  const s = getSecuritySettings?.() || {};
  const minLength = Number.isFinite(Number(s?.password?.minLength))
    ? Number(s.password.minLength)
    : 8;

  if (newPassword.length < minLength) {
    return res.status(400).json({
      ok: false,
      error: "password_too_short",
      minLength,
    });
  }

  const user = await IamUser.findOne({ email }).select("+passwordHash").exec();
  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
  if (String(user.provider || "").toLowerCase() !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  const expiresDays = Number.isFinite(Number(s?.password?.expiresDays))
    ? Number(s.password.expiresDays)
    : 0;

  user.passwordExpiresAt =
    expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : undefined;

  await user.save();

  return res.json({ ok: true });
}

/* =========================================================
   Rutas principales
========================================================= */
r.post("/login-otp", loginOtpHandler);
r.post("/verify-otp", verifyOtpHandler);
r.post("/change-password", changePasswordHandler);

/* =========================================================
   ✅ ALIASES de compatibilidad (por si lo montas en /auth o no)
   Esto te salva de 404 según dónde montes el router.
========================================================= */
r.post("/auth/login-otp", loginOtpHandler);
r.post("/auth/verify-otp", verifyOtpHandler);
r.post("/auth/change-password", changePasswordHandler);

export default r;