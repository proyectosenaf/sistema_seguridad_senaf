// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

const r = Router();

/**
 * GET /api/iam/v1/me
 * Devuelve contexto del usuario actual (user/roles/permissions)
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await buildContextFrom(req);
    // ctx esperado: { user, roles, permissions }
    res.json({
      ok: true,
      user: ctx.user || null,
      roles: ctx.roles || [],
      permissions: ctx.permissions || [],
    });
  } catch (e) {
    next(e);
  }
});

export default r;
