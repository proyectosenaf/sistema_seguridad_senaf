// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

// Importando jwt para accesos y seguridad en los roles, creado el 20/02/2026 
import jwt from "jsonwebtoken";
// Importando jwt para accesos y seguridad en los roles, creado el 20/02/2026 


// Log simple (ok)
console.log("[iam] boot", {
  NODE_ENV: process.env.NODE_ENV,
  IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
});

export function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// function getJwtPayload(req) {
//   return req?.auth?.payload || null; // express-oauth2-jwt-bearer
// }

//Usar el JWT para accesos creado el 20/02/2026, para obtener los roles y permisos del usuario autenticado
function getJwtPayload(req) {
  //intenta Auth0
  if (req?.auth?.payload) {
    return req.auth.payload;
  }

  // intenta JWT local si no hay payload de Auth0 (p.ej. en login local)
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
  } catch {
    return null;
  }
}
//Usar el JWT para accesos creado el 20/02/2026, para obtener los roles y permisos del usuario autenticado

function getAuth0Sub(payload) {
  const sub = payload?.sub;
  return sub ? String(sub).trim() : null;
}

function getEmailFromPayload(payload) {
  if (!payload) return null;

  // estándar (muchas veces NO viene en access token)
  const direct = payload.email;
  if (direct) return String(direct).toLowerCase().trim();

  // custom claim recomendado (Action)
  const ns = process.env.IAM_EMAIL_CLAIM || "https://senaf/email";
  const claimed = payload[ns];
  if (claimed) return String(claimed).toLowerCase().trim();

  return null;
}

/**
 * buildContextFrom(req)
 * - Auth0: identidad por sub (recomendado) y email (si existe)
 * - IAM: roles/perms desde MongoDB
 * - Si NO existe usuario en IAM => visitor
 */
export async function buildContextFrom(req) {
  const payload = getJwtPayload(req);

  // Identidad desde JWT (Auth0)
  const auth0Sub = getAuth0Sub(payload);
  const jwtEmail = getEmailFromPayload(payload);

  // Identidad desde headers dev (solo si permites, y solo en no-prod)
  const headerEmail = req?.headers?.["x-user-email"] || null;

  const IS_PROD = process.env.NODE_ENV === "production";
  const allowDevHeaders = !IS_PROD; // en prod jamás aceptes x-perms/x-roles como autoridad

  const email = (jwtEmail || (allowDevHeaders ? headerEmail : null) || "")
    .toLowerCase()
    .trim() || null;

  const headerRoles = allowDevHeaders ? parseList(req?.headers?.["x-roles"]) : [];
  const headerPerms = allowDevHeaders ? parseList(req?.headers?.["x-perms"]) : [];

  // Usuario en BD:
  // 1) Primero por auth0Sub (si lo tienes en tu modelo)
  // 2) Si no existe, fallback por email
  let user = null;

  if (auth0Sub) {
    try {
      user = await IamUser.findOne({ auth0Sub }).lean();
    } catch {
      // si el campo no existe aún, no rompas
      user = null;
    }
  }

  if (!user && email) {
    user = await IamUser.findOne({ email }).lean();
  }

  // roles base:
  // - si hay user: roles vienen de BD + (en dev) headers
  // - si NO hay user: roles solo headers (dev)
  const roleNames = new Set([...(user?.roles || []), ...headerRoles]);

  // perms base:
  const permSet = new Set([...(user?.perms || [])]);

  // En dev (no-prod) si NO hay user, se permite headerPerms explícito
  if (!user && allowDevHeaders) {
    headerPerms.forEach((p) => permSet.add(p));
  }

  // Resolver permisos por roles (IamRole.permissions)
  if (roleNames.size) {
    const roleList = [...roleNames].map((r) => String(r).trim());
    const roleDocs = await IamRole.find({
      $or: [{ code: { $in: roleList } }, { name: { $in: roleList } }],
    }).lean();

    for (const r of roleDocs) {
      (r.permissions || []).forEach((p) => permSet.add(p));
    }
  }

  // SUPERADMIN (único bypass válido)
  const superEmail = String(process.env.SUPERADMIN_EMAIL || "")
    .trim()
    .toLowerCase();

  const isSuperAdmin = !!email && !!superEmail && email === superEmail;

  function has(perm) {
    if (isSuperAdmin) return true;
    if (permSet.has("*")) return true;
    if (!perm) return true;
    return permSet.has(perm);
  }

  // visitor:
  // - Si hay JWT (payload) pero no existe user en BD => visitor=true
  const isVisitor = !!payload && !user;

  return {
    user, // puede ser null
    email, // puede ser null si token no trae email
    auth0Sub, // ✅ clave real de Auth0
    roles: [...roleNames],
    permissions: [...permSet],
    has,
    isSuperAdmin,
    isVisitor,
  };
}

/**
 * devOr(mw)
 * - En dev: salta permisos
 * - En prod: solo salta si IAM_DEV_ALLOW_ALL=1 (NO recomendado)
 */
export function devOr(mw) {
  const isProd = process.env.NODE_ENV === "production";
  const allow = process.env.IAM_DEV_ALLOW_ALL === "1" || !isProd;
  return (req, res, next) => (allow ? next() : mw(req, res, next));
}

/**
 * requirePerm("iam.users.manage")
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      // Si no hay JWT válido => 401
      if (!req?.auth?.payload) {
        return res.status(401).json({ message: "No autenticado" });
      }

      if (!ctx.has(perm)) {
        return res.status(403).json({
          message: "forbidden",
          need: perm,
          email: ctx.email,
          auth0Sub: ctx.auth0Sub,
          roles: ctx.roles,
          perms: ctx.permissions,
          visitor: ctx.isVisitor,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}
