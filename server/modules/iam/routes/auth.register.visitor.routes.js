// server/modules/iam/routes/auth.register.visitor.routes.js
import { Router } from "express";

import IamUser from "../models/IamUser.model.js";
import { hashPassword } from "../utils/password.util.js";
import { getSecuritySettings } from "../services/settings.service.js";
import { createOtp } from "../services/otp.service.js";
import { sendOtpEmail } from "../services/otp.mailer.js";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeName(v) {
  return String(v || "").trim();
}

function hasNonEmptyPassword(p) {
  return String(p || "").trim().length >= 8;
}

function rolesOf(u) {
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  return roles.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
}

function isInternalUser(u) {
  const roles = rolesOf(u);
  return roles.some((x) => ["admin", "guardia", "superadmin"].includes(x));
}

function maskEmail(email) {
  const e = normEmail(email);
  const [u, d] = e.split("@");
  if (!u || !d) return e;
  const uu = u.length <= 2 ? `${u[0] || ""}*` : `${u.slice(0, 2)}***`;
  return `${uu}@${d}`;
}

function getSettings() {
  const s = getSecuritySettings?.() || {};
  return {
    otp: s.otp || { ttlSeconds: 300, maxAttempts: 5, resendCooldownSeconds: 30 },
    password: s.password || { minLength: 8, expiresDays: 0 },
    features: s.features || { enableEmployeeOtp: true, enablePublicOtp: true },
  };
}

/**
 * POST /register-visitor
 * body: { name, email, password }
 *
 * - Si existe interno => 403 email_reserved
 * - Si existe visita => reenviar OTP (crea OTP nuevo) y responde ok
 * - Si no existe => crea visita + manda OTP
 */
r.post("/register-visitor", async (req, res, next) => {
  try {
    const settings = getSettings();

    const name = safeName(req.body?.name);
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "name_required" });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "email_required" });
    if (!hasNonEmptyPassword(password)) {
      return res.status(400).json({ ok: false, error: "password_too_short", minLength: 8 });
    }

    if (!settings.features.enablePublicOtp) {
      return res.status(403).json({ ok: false, error: "public_otp_disabled" });
    }

    const existing = await IamUser.findOne({ email }).exec();

    if (existing) {
      if (!existing.active) return res.status(403).json({ ok: false, error: "user_inactive" });

      if (isInternalUser(existing)) {
        return res.status(403).json({
          ok: false,
          error: "email_reserved",
          message: "Este correo pertenece a un usuario interno. Usa Acceso Interno.",
        });
      }

      // ✅ Ya es visitante: emitir OTP nuevo
      const created = await createOtp({
        email,
        purpose: "visitor-login",
        meta: { userId: existing._id },
      });

      const mail = await sendOtpEmail({ to: email, code: created.code, purpose: "visitor-login" });
      if (mail?.ok === false) {
        return res.status(502).json({
          ok: false,
          error: "mail_send_failed",
          message: mail?.message || "No se pudo enviar el correo OTP.",
        });
      }

      return res.json({
        ok: true,
        otpRequired: true,
        sentTo: maskEmail(email),
        ttlSeconds: settings.otp.ttlSeconds,
        resendCooldownSeconds: settings.otp.resendCooldownSeconds,
      });
    }

    const passwordHash = await hashPassword(password);

    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 2);

    const user = await IamUser.create({
      email,
      name,
      provider: "local",
      active: true,
      roles: ["visita"],
      perms: [],
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: now,
      passwordExpiresAt: expires,
      otpVerifiedAt: null,
    });

    const created = await createOtp({
      email,
      purpose: "visitor-login",
      meta: { userId: user._id },
    });

    const mail = await sendOtpEmail({ to: email, code: created.code, purpose: "visitor-login" });
    if (mail?.ok === false) {
      return res.status(502).json({
        ok: false,
        error: "mail_send_failed",
        message: mail?.message || "No se pudo enviar el correo OTP.",
      });
    }

    return res.status(201).json({
      ok: true,
      otpRequired: true,
      sentTo: maskEmail(email),
      ttlSeconds: settings.otp.ttlSeconds,
      resendCooldownSeconds: settings.otp.resendCooldownSeconds,
      created: { id: String(user._id), email: user.email, name: user.name },
    });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ ok: false, error: "user_exists" });
    next(e);
  }
});

export default r;