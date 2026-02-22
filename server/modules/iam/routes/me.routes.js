// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";
import IamUser from "../models/IamUser.model.js";

const r = Router();

/**
 * GET /api/iam/v1/me
 * - Sin token válido -> visitor:true (sin identidad)
 * - Con token válido -> crea usuario si no existe (rol: "visita")
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await buildContextFrom(req);

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
    if (auth0Sub) u = await IamUser.findOne({ auth0Sub }).exec();
    if (!u && email) u = await IamUser.findOne({ email }).exec();

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

      u = await IamUser.create({
        email,
        name: email.split("@")[0],
        roles: ["visita"], // ✅ rol default
        perms: [],
        active: true,
        provider: "auth0",
        auth0Sub: auth0Sub || undefined,
      });
    } else {
      // Si ya existe pero no tiene auth0Sub y ahora sí viene, lo guardamos
      if (!u.auth0Sub && auth0Sub) {
        u.auth0Sub = auth0Sub;
        await u.save();
      }

      // Normaliza rol legacy "visitor" -> "visita" (por si ya lo creaste antes)
      if (Array.isArray(u.roles) && u.roles.includes("visitor") && !u.roles.includes("visita")) {
        u.roles = u.roles.filter((x) => x !== "visitor");
        u.roles.push("visita");
        await u.save();
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
    next(e);
  }
});

export default r;