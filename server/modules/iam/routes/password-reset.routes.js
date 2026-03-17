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

const r = Router();

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
    message: "Si el correo existe, se enviaron instrucciones para restablecer la contraseña.",
  });
}

function passwordPolicy(password) {
  const s = String(password || "");
  if (s.length < 8) return "Debe tener al menos 8 caracteres.";
  return null;
}

r.post("/request-password-reset", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const user = await IamUser.findOne({ email })
      .select(
        "_id email active provider roles tempPassHash tempPassExpiresAt tempPassUsedAt tempPassAttempts updatedAt"
      )
      .exec();

    if (!user) return genericResetResponse(res);
    if (String(user.provider || "").toLowerCase() !== "local") return genericResetResponse(res);
    if (user.active === false) return genericResetResponse(res);
    if (hasRole(user, "visita")) return genericResetResponse(res);

    const now = new Date();
    const recentRequestWindowMs = 60 * 1000;

    const hasRecent =
      user.tempPassExpiresAt &&
      !isExpired(user.tempPassExpiresAt) &&
      user.tempPassUsedAt == null &&
      user.updatedAt &&
      now.getTime() - new Date(user.updatedAt).getTime() < recentRequestWindowMs;

    if (hasRecent) {
      return genericResetResponse(res);
    }

    const token = String(makeResetToken()).trim().toUpperCase();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    user.tempPassHash = hashResetToken(token);
    user.tempPassExpiresAt = expiresAt;
    user.tempPassUsedAt = null;
    user.tempPassAttempts = 0;

    await user.save();

    await sendResetEmail({
      email: user.email,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    if (!isProd()) {
      return res.json({
        ok: true,
        message: "DEV: token generado. En producción esto se envía por correo.",
        token,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return genericResetResponse(res);
  } catch (e) {
    console.error("request-password-reset error:", e);
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
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    if (passwordNueva !== confirmarPassword) {
      return res.status(400).json({ ok: false, error: "password_mismatch" });
    }

    const policyError = passwordPolicy(passwordNueva);
    if (policyError) {
      return res.status(400).json({
        ok: false,
        error: "invalid_password",
        message: policyError,
      });
    }

    const user = await IamUser.findOne({ email })
      .select(
        "+passwordHash +tempPassHash tempPassExpiresAt tempPassUsedAt tempPassAttempts roles active provider mustChangePassword passwordChangedAt passwordExpiresAt"
      )
      .exec();

    if (!user) {
      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (String(user.provider || "").toLowerCase() !== "local") {
      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (user.active === false) {
      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (hasRole(user, "visita")) {
      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    if (!user.tempPassHash || !user.tempPassExpiresAt) {
      return res.status(400).json({ ok: false, error: "reset_not_requested" });
    }

    if (user.tempPassUsedAt) {
      return res.status(400).json({ ok: false, error: "reset_already_used" });
    }

    if (isExpired(user.tempPassExpiresAt)) {
      return res.status(400).json({ ok: false, error: "reset_expired" });
    }

    const maxAttempts = Number(process.env.IAM_RESET_MAX_ATTEMPTS || 5);
    if ((user.tempPassAttempts || 0) >= maxAttempts) {
      return res.status(429).json({ ok: false, error: "too_many_attempts" });
    }

    const gotHash = hashResetToken(token);
    if (gotHash !== user.tempPassHash) {
      user.tempPassAttempts = (user.tempPassAttempts || 0) + 1;
      await user.save();

      return res.status(400).json({ ok: false, error: "invalid_reset_token" });
    }

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

    return res.json({
      ok: true,
      message: "Contraseña restablecida correctamente. Ya puedes iniciar sesión.",
    });
  } catch (e) {
    console.error("reset-password error:", e);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "No se pudo restablecer la contraseña.",
    });
  }
});

export default r;