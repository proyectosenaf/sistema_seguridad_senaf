// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

const r = Router();

/**
 * GET /api/iam/v1/me
 *
 * - Si NO hay token válido -> visitor:true
 * - Si hay token válido -> usa Auth0 (req.auth.payload) o JWT local (Authorization Bearer)
 *
 * ✅ Corrección:
 * - No construyas un req "fake". Pasa el req real a buildContextFrom(req)
 *   para que soporte Auth0 + JWT local + (dev headers si están permitidos).
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await buildContextFrom(req);

    // Si no hay token válido, buildContextFrom devuelve email=null y user=null,
    // pero ctx.isVisitor solo se enciende si hubo payload y no hubo user.
    // Para "visitor:true" de verdad (sin token), determinamos si hay identidad:
    const hasIdentity = !!ctx.auth0Sub || !!ctx.email;

    if (!hasIdentity) {
      return res.json({
        ok: true,
        user: null,
        roles: [],
        permissions: [],
        visitor: true,
        email: null,
        isSuperAdmin: false,
      });
    }

    return res.json({
      ok: true,
      user: ctx.user || null,
      roles: ctx.roles || [],
      permissions: ctx.permissions || [],
      // visitor aquí significa: autenticó pero aún no está en IAM (o no se pudo mapear)
      visitor: !!ctx.isVisitor,
      email: ctx.email || null,
      isSuperAdmin: !!ctx.isSuperAdmin,
      auth0Sub: ctx.auth0Sub || null,
    });
  } catch (e) {
    next(e);
  }
});

export default r;