// server/modules/iam/routes/auth.routes.js
import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import { signToken, verifyToken, getBearer } from "../utils/jwt.util.js";

const r = Router();

/* ===================== helpers ===================== */
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function getClientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.ip || req.connection?.remoteAddress || "";
}

function ensureEnv(name) {
  const v = String(process.env[name] || "").trim();
  return v || null;
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function signUserToken(user) {
  // ⚠️ Compat: roles/perms en token. Fuente canónica: DB via buildContextFrom(/me)
  const payload = {
    sub: String(user._id),
    email: user.email,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.perms) ? user.perms : [],
    provider: "local",
  };

  return signToken(payload, { expiresIn: "8h" });
}

/** Expira password por regla: 2 meses desde passwordChangedAt, o por passwordExpiresAt si ya viene */
function computePasswordExpired(user) {
  const now = new Date();

  if (user?.passwordExpiresAt && now > user.passwordExpiresAt) return true;

  // fallback: 2 meses desde passwordChangedAt (si existe)
  const changedAt = user?.passwordChangedAt ? new Date(user.passwordChangedAt) : null;
  if (changedAt && !Number.isNaN(changedAt.getTime())) {
    const exp = new Date(changedAt);
    exp.setMonth(exp.getMonth() + 2);
    if (now > exp) return true;
  }

  return false;
}

/* ===================== mailer ===================== */
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

async function sendResetEmail({ to, link, token }) {
  const transport = makeMailer();
  const from = ensureEnv("MAIL_FROM") || ensureEnv("MAIL_USER");
  const appName = ensureEnv("APP_NAME") || "SENAF";

  if (!transport) {
    console.warn("[reset] MAIL_* no configurado. RESET para", to);
    console.warn("[reset] link:", link);
    console.warn("[reset] token:", token);
    return { ok: true, dev: true };
  }

  await transport.sendMail({
    from,
    to,
    subject: `${appName} — Restablecer contraseña`,
    text:
      `Solicitaste restablecer tu contraseña.\n\n` +
      `Abre este enlace:\n${link}\n\n` +
      `Si no fuiste tú, ignora este mensaje.`,
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>${appName}</h2>
        <p>Solicitaste restablecer tu contraseña.</p>
        <p><a href="${link}">Restablecer contraseña</a></p>
        <p style="color:#666;font-size:12px">Si no fuiste tú, ignora este mensaje.</p>
      </div>
    `,
  });

  return { ok: true };
}

/* ===================== Password reset tokens (in-memory) =====================
   En producción ideal: Mongo/Redis.
   Para arrancar ya: memoria.
================================================================================ */
const RESET_STORE = new Map();
/**
 * key: email
 * value: { tokenHash, exp, attempts, lastSentAt }
 */

function isExpired(entry) {
  return !entry?.exp || Date.now() > entry.exp;
}

function canResend(entry, cooldownSeconds) {
  if (!entry?.lastSentAt) return true;
  return Date.now() - entry.lastSentAt >= cooldownSeconds * 1000;
}

/* ===================== LOGIN (LOCAL) ===================== */
r.post("/login", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email_password_required" });
    }

    const user = await IamUser.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });

    if (user.provider !== "local") {
      return res.status(400).json({
        ok: false,
        error: "user_not_local",
        message: "Este usuario no es local (provider != local).",
      });
    }

    if (!user.active) return res.status(403).json({ ok: false, error: "user_inactive" });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, error: "invalid_credentials" });

    // expiración password
    let mustChange = !!user.mustChangePassword;
    if (!mustChange && computePasswordExpired(user)) mustChange = true;

    // auditoría (no bloquea login si falla)
    try {
      user.lastLoginAt = new Date();
      user.lastLoginIp = getClientIp(req);
      await user.save();
    } catch {
      // ignore
    }

    const token = signUserToken(user);

    return res.json({ ok: true, token, mustChangePassword: mustChange });
  } catch (e) {
    next(e);
  }
});

/* ===================== LOGOUT (LOCAL) ===================== */
r.post("/logout", async (_req, res) => {
  return res.json({ ok: true });
});

/* ===================== CHANGE PASSWORD (LOCAL) ===================== */
r.post("/change-password", async (req, res, next) => {
  try {
    const token = getBearer(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "token_required" });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({ ok: false, error: "token_invalid_or_expired" });
    }

    const userId = decoded?.sub ? String(decoded.sub) : null;
    if (!userId) return res.status(401).json({ ok: false, error: "token_invalid" });

    const passwordActual = String(req.body?.passwordActual || "");
    const passwordNueva = String(req.body?.passwordNueva || "");

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (passwordNueva.length < 8) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    const user = await IamUser.findById(userId).select("+passwordHash");
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    if (user.provider !== "local") {
      return res.status(400).json({ ok: false, error: "user_not_local" });
    }
    if (!user.active) return res.status(403).json({ ok: false, error: "user_inactive" });

    const match = await verifyPassword(passwordActual, user.passwordHash);
    if (!match) {
      return res.status(400).json({ ok: false, error: "current_password_wrong" });
    }

    const newHash = await hashPassword(passwordNueva);

    const now = new Date();
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 2);

    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.passwordExpiresAt = expires;
    await user.save();

    const newToken = signUserToken(user);

    return res.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
      token: newToken,
    });
  } catch (e) {
    next(e);
  }
});

/* ===================== REQUEST PASSWORD RESET ===================== */
/**
 * POST /auth/request-password-reset
 * body: { email }
 * - genera token de reset (TTL corto) y manda link por correo
 * - no revela si existe o no (para evitar enumeración)
 */
r.post("/request-password-reset", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    // Ajustes básicos
    const ttlMinutes = Number(process.env.RESET_TTL_MINUTES || 15);
    const resendCooldownSeconds = Number(process.env.RESET_RESEND_COOLDOWN_SECONDS || 30);

    const existing = RESET_STORE.get(email);
    if (existing && !isExpired(existing) && !canResend(existing, resendCooldownSeconds)) {
      return res.status(429).json({
        ok: false,
        error: "reset_resend_cooldown",
        message: `Espera ${resendCooldownSeconds}s para reenviar.`,
      });
    }

    // buscamos usuario, pero respondemos OK siempre
    const user = await IamUser.findOne({ email }).select("_id email active provider").lean();

    if (!user || !user.active || String(user.provider || "").toLowerCase() !== "local") {
      // respuesta uniforme
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);
    const exp = Date.now() + ttlMinutes * 60 * 1000;

    RESET_STORE.set(email, {
      tokenHash,
      exp,
      attempts: 0,
      lastSentAt: Date.now(),
    });

    const appUrl =
      ensureEnv("APP_URL") || ensureEnv("PUBLIC_APP_URL") || "http://localhost:5173";

    // link al frontend (tú decides ruta final de reset)
    // Si aún no tienes página /reset-password, igual puedes usar /force-change-password y luego construir la UI.
    const link = `${String(appUrl).replace(/\/$/, "")}/reset-password?email=${encodeURIComponent(
      email
    )}&token=${encodeURIComponent(token)}`;

    await sendResetEmail({ to: email, link, token });

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ===================== RESET PASSWORD ===================== */
/**
 * POST /auth/reset-password
 * body: { email, token, newPassword }
 * - valida token (in-memory) y establece nueva contraseña
 */
r.post("/reset-password", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!email || !token || !newPassword) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    const entry = RESET_STORE.get(email);
    if (!entry) return res.status(400).json({ ok: false, error: "reset_not_found" });
    if (isExpired(entry)) {
      RESET_STORE.delete(email);
      return res.status(400).json({ ok: false, error: "reset_expired" });
    }

    // máximo intentos
    const maxAttempts = Number(process.env.RESET_MAX_ATTEMPTS || 5);
    if (entry.attempts >= maxAttempts) {
      RESET_STORE.delete(email);
      return res.status(429).json({ ok: false, error: "reset_max_attempts" });
    }

    entry.attempts += 1;
    RESET_STORE.set(email, entry);

    const ok = sha256(token) === entry.tokenHash;
    if (!ok) return res.status(401).json({ ok: false, error: "reset_invalid" });

    // ok => consumimos
    RESET_STORE.delete(email);

    const user = await IamUser.findOne({ email }).select("+passwordHash").exec();
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
    if (!user.active) return res.status(403).json({ ok: false, error: "user_inactive" });
    if (String(user.provider || "").toLowerCase() !== "local") {
      return res.status(403).json({ ok: false, error: "not_local_user" });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();

    // vence en 2 meses
    const exp2m = new Date();
    exp2m.setMonth(exp2m.getMonth() + 2);
    user.passwordExpiresAt = exp2m;

    await user.save();

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ===================== BOOTSTRAP ADMIN (LOCAL) ===================== */
r.post("/bootstrap", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email_password_required" });
    }

    const count = await IamUser.countDocuments({});
    if (count > 0) {
      return res.status(409).json({ ok: false, error: "bootstrap_not_available" });
    }

    const rootAdmins = String(process.env.ROOT_ADMINS || "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
    const allowed = (superEmail && email === superEmail) || rootAdmins.includes(email);

    if (!allowed) {
      return res.status(403).json({ ok: false, error: "bootstrap_email_not_allowed" });
    }

    const passwordHash = await hashPassword(password);

    const user = await IamUser.create({
      email,
      name: name || email.split("@")[0],
      provider: "local",
      passwordHash,
      active: true,
      roles: ["admin"],
      perms: ["*"],
      mustChangePassword: false,
    });

    return res.status(201).json({
      ok: true,
      created: { id: String(user._id), email: user.email },
      message: "Admin bootstrap creado. Ya puedes usar /auth/login",
    });
  } catch (e) {
    next(e);
  }
});

export default r;