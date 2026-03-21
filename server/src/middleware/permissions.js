import { buildContextFrom } from "../../modules/iam/utils/rbac.util.js";

/* =========================
   HELPERS
========================= */
function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

function normalizeRoles(rawRoles = []) {
  return rawRoles
    .map((r) => {
      if (typeof r === "string") return r;
      if (r && typeof r === "object") {
        return r.code || r.key || r.slug || r.name || r.nombre || "";
      }
      return "";
    })
    .map((r) => String(r || "").trim())
    .filter(Boolean);
}

function normalizePermissions(rawPermissions = []) {
  return rawPermissions
    .map((p) => String(p || "").trim())
    .filter(Boolean);
}

function hydrateReqIdentity(req, ctx) {
  const roles = normalizeRoles(ctx?.roles || []);
  const permissions = normalizePermissions(ctx?.permissions || []);

  const mergedUser = {
    ...(req.user || {}),
    ...(req.auth || {}),
    _id:
      req?.user?._id ||
      req?.auth?._id ||
      ctx?._id ||
      ctx?.id ||
      ctx?.userId ||
      ctx?.sub ||
      "",
    id:
      req?.user?.id ||
      req?.auth?.id ||
      ctx?.id ||
      ctx?.userId ||
      ctx?.sub ||
      ctx?._id ||
      "",
    sub:
      req?.user?.sub ||
      req?.auth?.sub ||
      ctx?.sub ||
      ctx?.id ||
      ctx?.userId ||
      ctx?._id ||
      "",
    email:
      req?.user?.email ||
      req?.auth?.email ||
      ctx?.email ||
      "",
    name:
      req?.user?.name ||
      req?.auth?.name ||
      ctx?.name ||
      ctx?.nombreCompleto ||
      "",
    nombreCompleto:
      req?.user?.nombreCompleto ||
      req?.auth?.nombreCompleto ||
      ctx?.nombreCompleto ||
      ctx?.name ||
      "",
    roles: uniq([
      ...normalizeRoles(req?.user?.roles || []),
      ...normalizeRoles(req?.auth?.roles || []),
      ...roles,
    ]),
    permissions: uniq([
      ...normalizePermissions(req?.user?.permissions || []),
      ...normalizePermissions(req?.auth?.permissions || []),
      ...permissions,
    ]),
    isSuperAdmin: !!ctx?.isSuperAdmin,
    isVisitor: !!ctx?.isVisitor,
  };

  req.user = mergedUser;
  req.auth = mergedUser;
}

/* =========================
   CONTEXTO IAM
========================= */
async function ensureIam(req) {
  if (req.iam) {
    hydrateReqIdentity(req, req.iam);
    return req.iam;
  }

  const ctx = await buildContextFrom(req);
  req.iam = ctx || {};
  hydrateReqIdentity(req, req.iam);
  return req.iam;
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

      const ok = typeof ctx.has === "function" ? ctx.has(perm) : false;

      if (!ok) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
          need: perm,
          roles: req.user?.roles || ctx.roles || [],
          permissions: req.user?.permissions || ctx.permissions || [],
          email: req.user?.email || ctx.email || null,
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
          roles: req.user?.roles || ctx.roles || [],
          permissions: req.user?.permissions || ctx.permissions || [],
          email: req.user?.email || ctx.email || null,
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
   ROLE CHECK
========================= */
export function requireRole(...rolesAllowed) {
  return async (req, res, next) => {
    try {
      const ctx = await ensureIam(req);

      if (!isAuthed(ctx)) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
      }

      const roles = normalizeRoles(req.user?.roles || ctx.roles || []).map((r) =>
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
          email: req.user?.email || ctx.email || null,
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
   ADMIN REAL
========================= */
export async function requireAdmin(req, res, next) {
  try {
    const ctx = await ensureIam(req);

    if (!isAuthed(ctx)) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    if (ctx.isSuperAdmin) {
      return next();
    }

    const ok =
      typeof ctx.has === "function"
        ? ctx.has("iam.users.write") || ctx.has("iam.roles.write")
        : false;

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Acceso solo para administradores",
        roles: req.user?.roles || ctx.roles || [],
        permissions: req.user?.permissions || ctx.permissions || [],
        email: req.user?.email || ctx.email || null,
      });
    }

    return next();
  } catch (e) {
    return next(e);
  }
}