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
 * - Con token válido:
 *    - buildContextFrom hace lookup en Mongo
 *    - (si aplica) auto-provision "visita" si no existe (requiere email)
 *    - expansión roles -> permissions desde IamRole (si tu rbac.util lo implementa)
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await withTimeout(buildContextFrom(req), 7000, "buildContextFrom");

    const email = String(ctx.email || "").toLowerCase().trim() || null;

    // 1) Sin identidad real (no token válido)
    if (!email) {
      return res.json({
        ok: true,
        user: null,
        roles: [],
        permissions: [],
        perms: [], // alias
        visitor: true,
        email: null,
        isSuperAdmin: false,
        mustChangePassword: false,
      });
    }

    // 2) Hay identidad pero buildContextFrom no pudo resolver usuario
    // (normalmente: token inválido, user borrado, DB caída, etc.)
    if (!ctx.user) {
      return res.status(401).json({
        ok: false,
        error: "user_not_resolved",
        message:
          "Token válido (email presente) pero no se pudo resolver el usuario en IAM. Revisa que exista en Mongo o que buildContextFrom esté creando el usuario 'visita' cuando aplique.",
        email,
      });
    }

    const u = ctx.user;

    const roles = Array.isArray(ctx.roles) ? ctx.roles : Array.isArray(u.roles) ? u.roles : [];
    const permissions = Array.isArray(ctx.permissions)
      ? ctx.permissions
      : Array.isArray(u.perms)
      ? u.perms
      : [];

    // ⚠️ mustChangePassword: si usas expiración también, lo puedes computar aquí
    let mustChangePassword = !!u.mustChangePassword;
    try {
      if (u.passwordExpiresAt && new Date() > new Date(u.passwordExpiresAt)) {
        mustChangePassword = true;
      }
    } catch {
      // ignore
    }

    return res.json({
      ok: true,
      user: {
        id: String(u._id || u.id || ""),
        email: u.email,
        name: u.name || "",
      },
      roles,
      permissions,
      perms: permissions, // ✅ alias para no romper UIs que usan "perms"
      visitor: !!ctx.isVisitor,
      email: u.email,
      isSuperAdmin: !!ctx.isSuperAdmin,
      mustChangePassword, // ✅
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