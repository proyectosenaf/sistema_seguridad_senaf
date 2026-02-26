// server/src/middleware/permissions.js
import { buildContextFrom } from "../../modules/iam/utils/rbac.util.js";

/**
 * Asegura que exista req.iam (contexto IAM)
 * - Si ya existe, no recalcula
 * - Si no, lo construye desde IAM (JWT -> email -> IamUser -> roles -> permisos)
 */
async function ensureIam(req) {
  if (req.iam) return req.iam;
  const ctx = await buildContextFrom(req);
  req.iam = ctx;
  return ctx;
}

function isAuthed(ctx) {
  // En tu nuevo modelo sin Auth0, identidad = email válido
  return !!ctx?.email;
}

/**
 * requirePerm("incidentes.read")
 * Permite acceso si el usuario posee el permiso exacto o "*"
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!isAuthed(ctx)) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const ok = typeof ctx.has === "function" ? ctx.has(perm) : false;

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: perm,
          roles: ctx.roles || [],
          permissions: ctx.permissions || [],
          email: ctx.email || null,
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
 */
export function requireAnyPerm(...perms) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!isAuthed(ctx)) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const ok =
        typeof ctx.has === "function"
          ? perms.some((p) => ctx.has(p))
          : false;

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: perms,
          roles: ctx.roles || [],
          permissions: ctx.permissions || [],
          email: ctx.email || null,
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
 * Alias compatible con tus routers:
 * requirePermission("a","b")
 */
export function requirePermission(...perms) {
  return requireAnyPerm(...perms);
}

/**
 * requireRole("admin")
 * Rol viene desde IAM (IamUser.roles)
 */
export function requireRole(...rolesAllowed) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!isAuthed(ctx)) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const roles = (ctx.roles || []).map((r) =>
        String(r).toLowerCase()
      );

      const ok = rolesAllowed.some((r) =>
        roles.includes(String(r).toLowerCase())
      );

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: rolesAllowed,
          roles,
          email: ctx.email || null,
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
 * Admin real = rol "admin" o permiso "*"
 */
export async function requireAdmin(req, res, next) {
  try {
    const ctx = await ensureIam(req);

    if (!isAuthed(ctx)) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const roles = (ctx.roles || []).map((r) =>
      String(r).toLowerCase()
    );

    const perms = Array.isArray(ctx.permissions)
      ? ctx.permissions
      : [];

    const ok = perms.includes("*") || roles.includes("admin");

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Acceso solo para administradores",
        roles,
        permissions: perms,
        email: ctx.email || null,
      });
    }

    return next();
  } catch (e) {
    return next(e);
  }
}