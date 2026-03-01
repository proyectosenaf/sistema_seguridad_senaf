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

function hasRole(user, role) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.map((x) => String(x).toLowerCase()).includes(String(role).toLowerCase());
}

function hashResetToken(token) {
  const pepper = String(process.env.IAM_RESET_PEPPER || "").trim() || "dev_pepper";
  return crypto.createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

function makeResetToken() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function isExpired(date) {
  if (!date) return true;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? true : Date.now() > t;
}

async function sendResetEmail({ email, token }) {
  if (!isProd()) {
    console.log("[password-reset] DEV token for", email, "=>", token);
  }
  return true;
}

r.post("/request-password-reset", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const genericOk = () =>
      res.json({
        ok: true,
        message: "Si el correo existe, se enviaron instrucciones para restablecer la contraseña.",
      });

    const user = await IamUser.findOne({ email }).select("_id email active provider roles").lean();

    if (!user) return genericOk();
    if (String(user.provider || "").toLowerCase() !== "local") return genericOk();
    if (user.active === false) return genericOk();

    // ✅ visitantes NO usan este reset
    if (Array.isArray(user.roles) && user.roles.map((x) => String(x).toLowerCase()).includes("visita")) {
      return genericOk();
    }

    const token = makeResetToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await IamUser.updateOne(
      { _id: user._id },
      {
        $set: {
          tempPassHash: hashResetToken(token),
          tempPassExpiresAt: expiresAt,
          tempPassUsedAt: null,
          tempPassAttempts: 0,
        },
      }
    );

    await sendResetEmail({ email: user.email, token });

    if (!isProd()) {
      return res.json({
        ok: true,
        message: "DEV: token generado. En producción esto se envía por correo.",
        token,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return genericOk();
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

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

    const user = await IamUser.findOne({ email }).select("+tempPassHash roles active provider").exec();

    if (!user || String(user.provider || "").toLowerCase() !== "local" || user.active === false) {
      return res.status(400).json({ ok: false, error: "invalid_reset" });
    }

    // ✅ visitantes no resetean por aquí
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

    const expectedHash = user.tempPassHash;
    const gotHash = hashResetToken(token);

    if (expectedHash !== gotHash) {
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
    return res.status(500).json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

export default r;