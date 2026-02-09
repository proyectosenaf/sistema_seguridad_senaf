// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

const r = Router();

/**
 * GET /api/iam/v1/me
 * Devuelve contexto del usuario actual (user/roles/permissions)
 * - Si no existe en IAM => ok:true, user:null, roles:[], permissions:[], visitor:true
 */
r.get("/", async (req, res, next) => {
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
