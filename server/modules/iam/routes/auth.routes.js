// server/modules/iam/routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";

import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";

const r = Router();

/* ===================== POST-REGISTER (AUTH0 WEBHOOK) ===================== */
/**
 * POST /api/iam/v1/auth/post-register
 * Llamado por Auth0 Action (Post User Registration).
 *
 * Headers:
 *  x-senaf-webhook-secret: <secret>
 *
 * Body:
 *  { email, auth0Sub, roles, perms, provider }
 */
r.post("/post-register", async (req, res, next) => {
  try {
    const secret = String(process.env.SENAF_WEBHOOK_SECRET || "");
    const got = String(req.headers["x-senaf-webhook-secret"] || "");

    // ✅ Bloquear si no hay secret configurado o no coincide
    if (!secret || got !== secret) {
      return res.status(401).json({ ok: false, error: "unauthorized_webhook" });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const auth0Sub = String(req.body?.auth0Sub || "").trim();

    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    // Normaliza defaults
    const rolesIn = Array.isArray(req.body?.roles) ? req.body.roles : null;
    const permsIn = Array.isArray(req.body?.perms) ? req.body.perms : null;

    // ✅ Tu rol default según tu app: "visita"
    const roles = rolesIn && rolesIn.length ? rolesIn : ["visita"];
    const perms = permsIn && permsIn.length ? permsIn : [];

    // 1) Busca por email
    let u = await IamUser.findOne({ email });

    // 2) Si no existe, crea
    if (!u) {
      u = await IamUser.create({
        email,
        name: email.split("@")[0],
        roles,
        perms,
        active: true,
        provider: "auth0",
        auth0Sub: auth0Sub || undefined,
      });
      return res.status(201).json({ ok: true, created: true, id: String(u._id), email: u.email });
    }

    // 3) Si existe, solo sincroniza auth0Sub si faltaba
    let changed = false;
    if (!u.auth0Sub && auth0Sub) {
      u.auth0Sub = auth0Sub;
      changed = true;
    }

    // (Opcional) merge roles/perms si quieres mantenerlo sincronizado:
    // const mergedRoles = Array.from(new Set([...(u.roles || []), ...roles]));
    // const mergedPerms = Array.from(new Set([...(u.perms || []), ...perms]));
    // if (JSON.stringify(mergedRoles) !== JSON.stringify(u.roles || [])) { u.roles = mergedRoles; changed = true; }
    // if (JSON.stringify(mergedPerms) !== JSON.stringify(u.perms || [])) { u.perms = mergedPerms; changed = true; }

    if (changed) await u.save();

    return res.json({ ok: true, updated: changed, id: String(u._id), email: u.email });
  } catch (e) {
    next(e);
  }
});

/* ===================== LOGIN (LOCAL) ===================== */
r.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    const user = await IamUser.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ error: "Credenciales no válidas" });

    if (user.provider !== "local") {
      return res.status(400).json({ error: "Usuario autenticado externamente (Auth0)" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciales no válidas" });

    if (!user.active) return res.status(403).json({ error: "Usuario inactivo" });

    // expiración password
    let mustChange = !!user.mustChangePassword;
    if (user.passwordExpiresAt && new Date() > user.passwordExpiresAt) mustChange = true;

    const token = jwt.sign(
      {
        sub: String(user._id),
        email: user.email,
        roles: user.roles,
        permissions: user.perms,
        provider: "local",
      },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "8h" }
    );

    return res.json({ token, mustChangePassword: mustChange });
  } catch (e) {
    next(e);
  }
});

/* ===================== CHANGE PASSWORD (LOCAL) ===================== */
r.post("/change-password", async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ ok: false, error: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido o expirado" });
    }

    const userId = decoded?.sub ? String(decoded.sub) : null;
    if (!userId) return res.status(401).json({ ok: false, error: "Token inválido" });

    const passwordActual = req.body?.passwordActual;
    const passwordNueva = req.body?.passwordNueva;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    const user = await IamUser.findById(userId).select("+passwordHash");
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    if (user.provider !== "local") {
      return res.status(400).json({ ok: false, error: "Usuario autenticado externamente (Auth0)" });
    }

    if (!user.active) return res.status(403).json({ ok: false, error: "Usuario inactivo" });

    const match = await verifyPassword(passwordActual, user.passwordHash);
    if (!match) return res.status(400).json({ ok: false, error: "Contraseña actual incorrecta" });

    const newHash = await hashPassword(passwordNueva);

    const now = new Date();
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 2);

    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.passwordExpiresAt = expires;
    await user.save();

    return res.json({ ok: true, message: "Contraseña actualizada correctamente" });
  } catch (e) {
    next(e);
  }
});

/* ===================== BOOTSTRAP ADMIN (LOCAL) ===================== */
/**
 * POST /api/iam/v1/auth/bootstrap
 * Solo si la colección está vacía. Crea primer admin local.
 */
r.post("/bootstrap", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const password = String(req.body?.password || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y password requeridos" });
    }

    const count = await IamUser.countDocuments({});
    if (count > 0) return res.status(409).json({ ok: false, error: "Bootstrap ya no disponible" });

    const rootAdmins = String(process.env.ROOT_ADMINS || "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
    const allowed = (superEmail && email === superEmail) || rootAdmins.includes(email);

    if (!allowed) return res.status(403).json({ ok: false, error: "Email no permitido para bootstrap" });

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