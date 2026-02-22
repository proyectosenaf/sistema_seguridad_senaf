// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";
import IamUser from "../models/IamUser.model.js";

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
 * - Con token válido -> crea usuario si no existe (rol: "visita")
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await withTimeout(buildContextFrom(req), 7000, "buildContextFrom");

    const email = String(ctx.email || "").toLowerCase().trim();
    const auth0Sub = String(ctx.auth0Sub || "").trim();

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
      });
    }

    // 2) Buscar usuario por auth0Sub primero (más estable), luego email
    let u = null;
    if (auth0Sub) u = await withTimeout(IamUser.findOne({ auth0Sub }).exec(), 5000, "IamUser.findOne(auth0Sub)");
    if (!u && email) u = await withTimeout(IamUser.findOne({ email }).exec(), 5000, "IamUser.findOne(email)");

    // 3) Autoprovision (pre-registro) si no existe
    if (!u) {
      // Tu esquema requiere email: si el token no trae email -> no podemos crear
      if (!email) {
        return res.status(401).json({
          ok: false,
          error: "email_missing_in_token",
          message:
            "El token no trae email. Verifica tu claim (namespace) o configura Auth0 para incluir email.",
        });
      }

      u = await withTimeout(
        IamUser.create({
          email,
          name: email.split("@")[0],
          roles: ["visita"], // ✅ rol default
          perms: [],
          active: true,
          provider: "auth0",
          auth0Sub: auth0Sub || undefined,
        }),
        5000,
        "IamUser.create"
      );
    } else {
      // Si ya existe pero no tiene auth0Sub y ahora sí viene, lo guardamos
      if (!u.auth0Sub && auth0Sub) {
        u.auth0Sub = auth0Sub;
        await withTimeout(u.save(), 5000, "IamUser.save(auth0Sub)");
      }

      // Normaliza rol legacy "visitor" -> "visita" (por si ya lo creaste antes)
      if (Array.isArray(u.roles) && u.roles.includes("visitor") && !u.roles.includes("visita")) {
        u.roles = u.roles.filter((x) => x !== "visitor");
        u.roles.push("visita");
        await withTimeout(u.save(), 5000, "IamUser.save(normalize-role)");
      }
    }

    const roles = Array.isArray(u.roles) ? u.roles : [];
    const perms = Array.isArray(u.perms) ? u.perms : [];

    return res.json({
      ok: true,
      user: { id: u._id, email: u.email, name: u.name },
      roles,
      permissions: perms,
      visitor: roles.includes("visita"),
      email: u.email,
      isSuperAdmin: !!ctx.isSuperAdmin,
      auth0Sub: u.auth0Sub || auth0Sub || null,
    });
  } catch (e) {
    // Si es timeout, responde claro (sin colgar UI)
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