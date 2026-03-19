// server/src/middleware/permissions.js
import { buildContextFrom } from "../../modules/iam/utils/rbac.util.js";

/* =========================
   CONTEXTO IAM
========================= */
async function ensureIam(req) {
  if (req.iam) return req.iam;
  const ctx = await buildContextFrom(req);
  req.iam = ctx;
  return ctx;
}

function isAuthed(ctx) {
  return !!ctx?.email;
}

/* =========================
   PERMISO ÚNICO
========================= */
export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!isAuthed(ctx)) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const ok =
        typeof ctx.has === "function"
          ? ctx.has(perm)
          : false;

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

/* =========================
   ANY OF PERMS
========================= */
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

/* =========================
   ALIAS
========================= */
export function requirePermission(...perms) {
  return requireAnyPerm(...perms);
}

/* =========================
   ROLE CHECK (solo si lo necesitas)
========================= */
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

/* =========================
   ADMIN REAL (CORREGIDO)
========================= */
export async function requireAdmin(req, res, next) {
  try {
    const ctx = await ensureIam(req);

    if (!isAuthed(ctx)) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    // ✅ SUPERADMIN bypass
    if (ctx.isSuperAdmin) {
      return next();
    }

    // ✅ ADMIN ahora basado en permisos reales (no roles)
    const ok =
      typeof ctx.has === "function"
        ? ctx.has("iam.users.write") || ctx.has("iam.roles.write")
        : false;

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Acceso solo para administradores",
        roles: ctx.roles || [],
        permissions: ctx.permissions || [],
        email: ctx.email || null,
      });
    }

    return next();
  } catch (e) {
    return next(e);
  }
}