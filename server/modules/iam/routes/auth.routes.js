// server/modules/iam/routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";

const r = Router();

/* ===================== helpers ===================== */
function safeEq(a = "", b = "") {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  if (aa.length === 0) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function isMongoDupKeyError(e) {
  const msg = String(e?.message || "");
  return e?.code === 11000 || msg.includes("E11000 duplicate key");
}

/* ===================== POST-REGISTER (AUTH0 WEBHOOK) ===================== */
/**
 * POST /api/iam/v1/auth/post-register
 * Llamado por Auth0 Action (Post User Registration).
 *
 * Headers:
 *  x-senaf-webhook-secret: <secret>
 *
 * Body:
 *  { email, auth0Sub, provider }
 *
 * ✅ Política SENAF:
 * - Auto-registro SIEMPRE crea "visita" si no existe.
 * - Empleados (guardia/admin/etc.) los crea/asigna el admin desde el módulo.
 * - NO confiar en roles/perms externos para auto-registro (seguridad).
 */
r.post("/post-register", async (req, res, next) => {
  try {
    const expected = String(process.env.SENAF_WEBHOOK_SECRET || "").trim();
    const got = String(req.headers["x-senaf-webhook-secret"] || "").trim();

    if (!expected || !got || !safeEq(got, expected)) {
      return res.status(401).json({ ok: false, error: "unauthorized_webhook" });
    }

    const email = normEmail(req.body?.email);
    const auth0Sub = String(req.body?.auth0Sub || "").trim();
    const provider = String(req.body?.provider || "auth0").trim();

    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const DEFAULT_ROLE = String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita")
      .trim()
      .toLowerCase();

    let u = await IamUser.findOne({ email });

    if (!u) {
      try {
        u = await IamUser.create({
          email,
          name: email.split("@")[0],
          roles: [DEFAULT_ROLE],
          perms: [],
          active: true,
          provider: provider === "local" ? "auth0" : provider, // harden
          auth0Sub: auth0Sub || undefined,
          // ⚠️ NO createdByAdmin aquí, porque esto es auto-registro
        });

        return res.status(201).json({
          ok: true,
          created: true,
          id: String(u._id),
          email: u.email,
          role: DEFAULT_ROLE,
        });
      } catch (e) {
        if (isMongoDupKeyError(e)) {
          u = await IamUser.findOne({ email });
          if (u) {
            return res.status(200).json({
              ok: true,
              existed: true,
              updated: false,
              id: String(u._id),
              email: u.email,
              note: "duplicate_race_resolved",
            });
          }
        }
        throw e;
      }
    }

    // Si existe, solo sincronizar auth0Sub si faltaba (NO tocar roles/perms)
    let changed = false;
    let warned = null;

    if (auth0Sub) {
      if (!u.auth0Sub) {
        u.auth0Sub = auth0Sub;
        changed = true;
      } else if (u.auth0Sub !== auth0Sub) {
        warned = "auth0Sub_mismatch_not_overwritten";
      }
    }

    if (changed) await u.save();

    return res.json({
      ok: true,
      existed: true,
      updated: changed,
      id: String(u._id),
      email: u.email,
      warn: warned,
    });
  } catch (e) {
    next(e);
  }
});

/* ===================== LOGIN (LOCAL) ===================== */
r.post("/login", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    const user = await IamUser.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ error: "Credenciales no válidas" });

    if (user.provider !== "local") {
      return res
        .status(400)
        .json({ error: "Usuario autenticado externamente (Auth0)" });
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
        roles: Array.isArray(user.roles) ? user.roles : [],
        permissions: Array.isArray(user.perms) ? user.perms : [],
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
      return res
        .status(400)
        .json({ ok: false, error: "Usuario autenticado externamente (Auth0)" });
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
r.post("/bootstrap", async (req, res, next) => {
  try {
    const email = normEmail(req.body?.email);
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