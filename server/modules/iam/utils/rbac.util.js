// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

// Pequeño log para ver cómo arranca IAM en producción
console.log("[iam] boot", {
  NODE_ENV: process.env.NODE_ENV,
  IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
});

/** Convierte header/lista en array limpio */
export function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 🧠 buildContextFrom(req)
 * - Fusiona:
 *    - usuario de BD (IamUser por email)
 *    - roles/permisos de cabeceras DEV (x-roles, x-perms)
 * - Resuelve roles → permisos usando IamRole (por code y por name)
 * - Expone:
 *    - user, roles[], permissions[]
 *    - has(p)
 */
export async function buildContextFrom(req) {
  // Email desde JWT (auth0) o desde headers dev
  const jwtEmail =
    req?.auth?.payload?.email ||
    req?.user?.email ||
    null;

  const headerEmail = req.headers["x-user-email"] || null;
  const email = (jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  const headerRoles = parseList(req.headers["x-roles"]);
  const headerPerms = parseList(req.headers["x-perms"]);

  // Usuario en BD (si hay email)
  let user = null;
  if (email) {
    user = await IamUser.findOne({ email }).lean();
  }

  // Set de roles y perms base
  const roleNames = new Set([...(user?.roles || []), ...headerRoles]);
  const permSet = new Set([...(user?.perms || [])]);

  // Solo si NO hay usuario en BD, aceptamos permisos desde headers (dev)
  if (!user) {
    headerPerms.forEach((p) => permSet.add(p));
  }

  // 🔎 Resolver permisos por rol usando code **y** name
  if (roleNames.size) {
    const roleList = [...roleNames].map((r) => String(r).trim());
    const roleDocs = await IamRole.find({
      $or: [{ code: { $in: roleList } }, { name: { $in: roleList } }],
    }).lean();

    for (const r of roleDocs) {
      (r.permissions || []).forEach((p) => permSet.add(p));
    }
  }

  // SUPERADMIN / ADMIN FULL
  const superEmail = String(
    process.env.SUPERADMIN_EMAIL || ""
  )
    .trim()
    .toLowerCase();

  const rolesLower = new Set(
    [...roleNames].map((r) => String(r).toLowerCase().trim())
  );

  const isSuperAdmin = !!email && !!superEmail && email === superEmail;
  const isAdminRole =
    rolesLower.has("admin") || rolesLower.has("ti");

  function has(perm) {
    // Superadmin y admin/ti → todo permitido
    if (isSuperAdmin) return true;
    if (isAdminRole) return true;

    // Permiso global
    if (permSet.has("*")) return true;

    // Si no se pide perm concreto, deja pasar
    if (!perm) return true;

    return permSet.has(perm);
  }

  return {
    user,
    email,
    roles: [...roleNames],
    permissions: [...permSet],
    has,
  };
}

/**
 * devOr(mw)
 * - En producción:
 *    - si IAM_DEV_ALLOW_ALL=1 → **salta** el middleware de permisos
 *    - si no → ejecuta mw normalmente
 * - En dev (NODE_ENV !== 'production') → siempre salta permisos
 */
export function devOr(mw) {
  const isProd = process.env.NODE_ENV === "production";
  const allowDev =
    process.env.IAM_DEV_ALLOW_ALL === "1" || !isProd;

  return (req, res, next) =>
    allowDev ? next() : mw(req, res, next);
}

/**
 * requirePerm("iam.users.manage")
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      if (!ctx.has(perm)) {
        console.warn("[iam] forbidden", {
          need: perm,
          email: ctx.email,
          roles: ctx.roles,
          perms: ctx.permissions,
        });
        return res
          .status(403)
          .json({ message: "forbidden", need: perm });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}
