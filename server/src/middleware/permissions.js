// server/src/middleware/permissions.js
import { buildContextFrom } from "../../modules/iam/utils/rbac.util.js";

/**
 * Asegura que exista req.iam (contexto IAM)
 * - Si ya existe, no recalcula
 * - Si no, lo construye desde IAM (email -> IamUser -> roles -> permisos)
 */
async function ensureIam(req) {
  if (req.iam) return req.iam;
  const ctx = await buildContextFrom(req);
  req.iam = ctx;
  return ctx;
}

/**
 * requirePerm("incidentes.read")
 * Permite acceso si el usuario posee el permiso exacto o "*"
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      // si no hay auth (sin email) => 401
      if (!ctx?.email) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const ok = ctx.has ? ctx.has(perm) : false;
      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: perm,
          roles: ctx.roles || [],
          permissions: ctx.permissions || [],
        });
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
}

/**
 * requireAnyPerm("a", "b", "c")
 * Permite acceso si el usuario tiene al menos uno
 */
export function requireAnyPerm(...perms) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!ctx?.email) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const ok =
        (ctx.permissions || []).includes("*") ||
        perms.some((p) => (ctx.permissions || []).includes(p));

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: perms,
          roles: ctx.roles || [],
          permissions: ctx.permissions || [],
        });
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
}

/**
 * requireRole("admin")
 * OJO: rol viene de IAM (IamUser.roles)
 */
export function requireRole(...rolesAllowed) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!ctx?.email) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const roles = (ctx.roles || []).map((r) => String(r).toLowerCase());
      const ok = rolesAllowed.some((r) => roles.includes(String(r).toLowerCase()));

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: rolesAllowed,
          roles,
        });
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
}

/**
 * requireAdmin
 * Admin real = rol "admin" en IAM o permiso "*"
 */
export function requireAdmin(req, res, next) {
  return requireAnyPerm("*")(req, res, () => requireRole("admin")(req, res, next));
}
