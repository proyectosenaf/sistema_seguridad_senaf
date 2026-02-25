import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

const r = Router();

/** Timeout helper (evita pending infinito si DB se cuelga) */
function withTimeout(promise, ms, label = "op") {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`[timeout] ${label} > ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * GET /api/iam/v1/me
 * - Sin token válido -> visitor:true (sin identidad)
 * - Con token válido -> buildContextFrom hace:
 *    - lookup en Mongo
 *    - auto-provision "visita" si no existe (si hay email)
 *    - expansión roles -> perms desde IamRole
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await withTimeout(buildContextFrom(req), 7000, "buildContextFrom");

    const email = String(ctx.email || "").toLowerCase().trim() || null;
    const auth0Sub = String(ctx.auth0Sub || "").trim() || null;

    // 1) Sin identidad real (no token válido)
    if (!email && !auth0Sub) {
      return res.json({
        ok: true,
        user: null,
        roles: [],
        permissions: [],
        visitor: true,
        email: null,
        isSuperAdmin: false,
        auth0Sub: null,
        mustChangePassword: false,
      });
    }

    // 2) Hay identidad pero buildContextFrom no pudo crear usuario (normalmente por falta de email)
    if (!ctx.user) {
      return res.status(401).json({
        ok: false,
        error: "email_missing_in_token",
        message:
          "Hay identidad (sub) pero el token no trae email y el esquema requiere email. Configura un claim de email o usa Auth0 Management API desde backend para resolverlo.",
        email: email,
        auth0Sub: auth0Sub,
      });
    }

    const u = ctx.user;

    return res.json({
      ok: true,
      user: { id: String(u._id || u.id || ""), email: u.email, name: u.name },
      roles: Array.isArray(ctx.roles) ? ctx.roles : [],
      permissions: Array.isArray(ctx.permissions) ? ctx.permissions : [],
      visitor: !!ctx.isVisitor,
      email: u.email,
      isSuperAdmin: !!ctx.isSuperAdmin,
      auth0Sub: u.auth0Sub || auth0Sub || null,
      mustChangePassword: !!u.mustChangePassword, // ✅
    });
  } catch (e) {
    if (String(e?.message || "").startsWith("[timeout]")) {
      return res.status(503).json({
        ok: false,
        error: "iam_timeout",
        message: e.message,
      });
    }
    next(e);
  }
});

export default r;