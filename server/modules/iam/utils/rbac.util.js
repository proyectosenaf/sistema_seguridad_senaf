// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

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

/**
 * buildContextFrom(req)
 * - Auth0: solo identidad (email)
 * - IAM: roles/perms desde MongoDB
 * - Si NO existe usuario en IAM => visitor (user=null, roles=[], permissions=[])
 */
export async function buildContextFrom(req) {
  // Email desde JWT (auth0) o desde headers dev
  const jwtEmail = req?.auth?.payload?.email || req?.authUser?.email || req?.user?.email || null;
  const headerEmail = req.headers["x-user-email"] || null;

  const email = (jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  const headerRoles = parseList(req.headers["x-roles"]);
  const headerPerms = parseList(req.headers["x-perms"]);

  // Usuario en BD (si hay email)
  let user = null;
  if (email) {
    user = await IamUser.findOne({ email }).lean();
  }

  // roles base:
  // - si hay user: roles vienen de BD + (en dev) headers
  // - si NO hay user: roles solo headers (dev)
  const roleNames = new Set([...(user?.roles || []), ...headerRoles]);

  // perms base:
  // - si hay user: perms vienen de BD (user.perms)
  // - si NO hay user: NO damos perms (visitor), excepto en DEV si mandas headers explícitos
  const permSet = new Set([...(user?.perms || [])]);

  const IS_PROD = process.env.NODE_ENV === "production";
  const allowDevHeaders = !IS_PROD; // en prod jamás aceptes x-perms/x-roles como autoridad

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
  const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const isSuperAdmin = !!email && !!superEmail && email === superEmail;

  function has(perm) {
    if (isSuperAdmin) return true;

    // Permiso global en IAM
    if (permSet.has("*")) return true;

    // Si no se pide permiso, no bloquees
    if (!perm) return true;

    return permSet.has(perm);
  }

  return {
    user, // puede ser null (visitor)
    email, // puede ser null si no autenticado
    roles: [...roleNames],
    permissions: [...permSet],
    has,
    isSuperAdmin,
    isVisitor: !!email && !user, // autenticado pero no existe en IAM
  };
}

/**
 * devOr(mw)
 * - En dev: salta permisos
 * - En prod: solo salta si IAM_DEV_ALLOW_ALL=1 (NO recomendado)
 */
export function devOr(mw) {
  const isProd = process.env.NODE_ENV === "production";
  const allow =
    process.env.IAM_DEV_ALLOW_ALL === "1" || !isProd;

  return (req, res, next) => (allow ? next() : mw(req, res, next));
}

/**
 * requirePerm("iam.users.manage") (deprecated si ya usas middleware/permissions.js)
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      if (!ctx.email) {
        return res.status(401).json({ message: "No autenticado" });
      }

      if (!ctx.has(perm)) {
        return res.status(403).json({
          message: "forbidden",
          need: perm,
          email: ctx.email,
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
