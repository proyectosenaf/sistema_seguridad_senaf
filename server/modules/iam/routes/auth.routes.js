// server/modules/iam/routes/auth.routes.js
import { Router } from "express";

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
    if (user.passwordExpiresAt && new Date() > user.passwordExpiresAt) mustChange = true;

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