// server/modules/iam/routes/auth.otp.routes.js
import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import { getSecuritySettings } from "../services/settings.service.js";

// Si ya tienes un mailer en otra parte, luego lo conectas.
// Por ahora: enviamos por SMTP usando nodemailer (simple y estándar).
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

function signLocalJwt(payload) {
  const secret = ensureEnv("JWT_SECRET") || "dev_secret";
  const expiresIn = String(process.env.JWT_EXPIRES_IN || "12h");
  return jwt.sign(payload, secret, { expiresIn });
}

function randomOtp6() {
  // 000000 - 999999
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

/* ---------------------- mailer ---------------------- */
function makeMailer() {
  const host = ensureEnv("MAIL_HOST");
  const port = Number(process.env.MAIL_PORT || 587);
  const secure = String(process.env.MAIL_SECURE || "0") === "1";
  const user = ensureEnv("MAIL_USER");
  const pass = ensureEnv("MAIL_PASS");

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendOtpEmail({ to, code }) {
  const transport = makeMailer();
  if (!transport) {
    // No romper: si no hay SMTP configurado, loguea en consola (DEV)
    console.warn("[otp] MAIL_* no configurado. OTP para", to, "=>", code);
    return { ok: true, dev: true };
  }

  const from = ensureEnv("MAIL_FROM") || ensureEnv("MAIL_USER");
  const appName = ensureEnv("APP_NAME") || "SENAF";

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
}

/* ---------------------- simple in-memory OTP store ----------------------
   Profesionalmente esto va a Mongo o Redis.
   Para que tu server ARRANQUE y funcione ya, lo dejamos en memoria.
   En producción con 1 instancia funciona; si escalas, se migra a DB/Redis.
------------------------------------------------------------------------- */
const OTP_STORE = new Map();
/**
 * key: email
 * value: {
 *   codeHash,
 *   exp,
 *   attempts,
 *   lastSentAt,
 * }
 */

function canResend(entry, cooldownSeconds) {
  if (!entry?.lastSentAt) return true;
  return Date.now() - entry.lastSentAt >= cooldownSeconds * 1000;
}

function isExpired(entry) {
  return !entry?.exp || Date.now() > entry.exp;
}

/* =========================================================
   POST /auth/login-otp
   body: { email, password }
   - valida credenciales del empleado (local)
   - manda OTP por correo
========================================================= */
r.post("/login-otp", async (req, res) => {
  const settings = getSecuritySettings();
  if (!settings.features.enableEmployeeOtp) {
    return res.status(403).json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email_and_password_required" });
  }

  // Empleados deben existir en IAM y ser provider=local
  const user = await IamUser.findOne({ email }).select("+passwordHash").lean();
  if (!user) {
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }
  if (!user.active) {
    return res.status(403).json({ ok: false, error: "user_inactive" });
  }
  if (String(user.provider || "").toLowerCase() !== "local") {
    return res.status(403).json({ ok: false, error: "not_local_user" });
  }

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) {
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }

  // OTP entry
  const existing = OTP_STORE.get(email);
  if (existing && !isExpired(existing)) {
    if (!canResend(existing, settings.otp.resendCooldownSeconds)) {
      return res.status(429).json({
        ok: false,
        error: "otp_resend_cooldown",
        message: `Espera ${settings.otp.resendCooldownSeconds}s para reenviar.`,
      });
    }
  }

  const code = randomOtp6();
  const codeHash = sha256(code);
  const exp = Date.now() + settings.otp.ttlSeconds * 1000;

  OTP_STORE.set(email, {
    codeHash,
    exp,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  await sendOtpEmail({ to: email, code });

  return res.json({
    ok: true,
    sentTo: maskEmail(email),
    ttlSeconds: settings.otp.ttlSeconds,
  });
});

/* =========================================================
   POST /auth/verify-otp
   body: { email, otp }
   - valida OTP y devuelve JWT local
========================================================= */
r.post("/verify-otp", async (req, res) => {
  const settings = getSecuritySettings();
  if (!settings.features.enableEmployeeOtp) {
    return res.status(403).json({ ok: false, error: "employee_otp_disabled" });
  }

  const email = normEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ ok: false, error: "email_and_otp_required" });
  }

  const entry = OTP_STORE.get(email);
  if (!entry) {
    return res.status(400).json({ ok: false, error: "otp_not_found" });
  }
  if (isExpired(entry)) {
    OTP_STORE.delete(email);
    return res.status(400).json({ ok: false, error: "otp_expired" });
  }

  if (entry.attempts >= settings.otp.maxAttempts) {
    OTP_STORE.delete(email);
    return res.status(429).json({ ok: false, error: "otp_max_attempts" });
  }

  entry.attempts += 1;
  OTP_STORE.set(email, entry);

  const ok = sha256(otp) === entry.codeHash;
  if (!ok) {
    return res.status(401).json({ ok: false, error: "otp_invalid" });
  }

  // OTP OK => borrar
  OTP_STORE.delete(email);

  const user = await IamUser.findOne({ email }).lean();
  if (!user) {
    return res.status(404).json({ ok: false, error: "user_not_found" });
  }

  // Construir payload mínimo (tu buildContextFrom luego expande roles/perms desde Mongo)
  const token = signLocalJwt({
    sub: `local|${user._id}`,
    email: user.email,
    name: user.name || user.email,
    provider: "local",
  });

  return res.json({
    ok: true,
    token,
    mustChangePassword: !!user.mustChangePassword,
  });
});

/* =========================================================
   POST /auth/change-password
   body: { email, newPassword }
   - solo para empleados locales (y normalmente mustChangePassword=true)
========================================================= */
r.post("/change-password", async (req, res) => {
  const email = normEmail(req.body?.email);
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !newPassword) {
    return res.status(400).json({ ok: false, error: "email_and_newPassword_required" });
  }

  const settings = getSecuritySettings();
  if (newPassword.length < settings.password.minLength) {
    return res.status(400).json({
      ok: false,
      error: "password_too_short",
      minLength: settings.password.minLength,
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

  const expiresDays = Number(settings.password.expiresDays || 0);
  user.passwordExpiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : undefined;

  await user.save();

  return res.json({ ok: true });
});

export default r;