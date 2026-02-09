// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { optionalAuth, attachAuthUser } from "../../../src/middleware/auth.js";
import { buildContextFrom } from "../utils/rbac.util.js";

const r = Router();

/**
 * GET /api/iam/v1/me
 * Devuelve contexto del usuario actual (user/roles/permissions)
 * - Si NO viene token => visitor:true (no 401)
 * - Si viene token => valida JWT y construye contexto real
 */
r.get("/", optionalAuth, attachAuthUser, async (req, res, next) => {
  try {
    const ctx = await buildContextFrom(req);

    res.json({
      ok: true,
      user: ctx.user || null,
      roles: ctx.roles || [],
      permissions: ctx.permissions || [],
      visitor: !!ctx.isVisitor,
      email: ctx.email || null,
      isSuperAdmin: !!ctx.isSuperAdmin,
    });
  } catch (e) {
    next(e);
  }
});

export default r;
