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
 *
 * ✅ CORRECCIÓN:
 * - No uses solo ctx.email para decidir "autenticado" porque en Auth0 el access token
 *   puede no traer email (a veces no viene).
 * - Considera identidad por auth0Sub o email.
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      const isAuthed = !!ctx?.auth0Sub || !!ctx?.email;
      if (!isAuthed) {
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
          email: ctx.email || null,
          auth0Sub: ctx.auth0Sub || null,
          visitor: !!ctx.isVisitor,
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
 *
 * ✅ CORRECCIÓN:
 * - Igual que arriba: auth por auth0Sub OR email.
 * - Usa ctx.has si existe (para respetar superadmin y "*").
 */
export function requireAnyPerm(...perms) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      const isAuthed = !!ctx?.auth0Sub || !!ctx?.email;
      if (!isAuthed) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const ok =
        typeof ctx.has === "function"
          ? perms.some((p) => ctx.has(p))
          : (ctx.permissions || []).includes("*") ||
            perms.some((p) => (ctx.permissions || []).includes(p));

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: perms,
          roles: ctx.roles || [],
          permissions: ctx.permissions || [],
          email: ctx.email || null,
          auth0Sub: ctx.auth0Sub || null,
          visitor: !!ctx.isVisitor,
        });
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
}

/**
 * ✅ ALIAS compatible con tus routers:
 * requirePermission("a","b","*")  -> requireAnyPerm("a","b","*")
 */
export function requirePermission(...perms) {
  return requireAnyPerm(...perms);
}

/**
 * requireRole("admin")
 * OJO: rol viene de IAM (IamUser.roles)
 *
 * ✅ CORRECCIÓN:
 * - Auth por auth0Sub OR email.
 */
export function requireRole(...rolesAllowed) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      const isAuthed = !!ctx?.auth0Sub || !!ctx?.email;
      if (!isAuthed) {
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
          email: ctx.email || null,
          auth0Sub: ctx.auth0Sub || null,
          visitor: !!ctx.isVisitor,
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