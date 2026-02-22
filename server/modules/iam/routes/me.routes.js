// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";
import IamUser from "../models/IamUser.model.js"; // <-- ajusta el path si tu modelo está en otro lugar

const r = Router();

/**
 * GET /api/iam/v1/me
 * - Sin token válido -> visitor:true (sin identidad)
 * - Con token válido -> crea usuario si no existe (rol: visita)
 */
r.get("/", async (req, res, next) => {
  try {
    const ctx = await buildContextFrom(req);

    const email = String(ctx.email || "").toLowerCase().trim();
    const auth0Sub = String(ctx.auth0Sub || "").trim();

    // 1) Sin identidad (no token válido)
    if (!email && !auth0Sub) {
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

    // 2) Buscar usuario por email o auth0Sub
    let u = null;
    if (email) u = await IamUser.findOne({ email });
    if (!u && auth0Sub) u = await IamUser.findOne({ auth0Sub });

    // 3) Autoprovision (pre-registro) si no existe
    if (!u) {
      // si no hay email no permitas crear (porque tu esquema exige email)
      if (!email) {
        return res.status(401).json({ ok: false, error: "email_missing_in_token" });
      }

      u = await IamUser.create({
        email,
        name: email.split("@")[0],
        roles: ["visita"],   // ✅ rol default
        perms: [],
        active: true,
        provider: "auth0",
        auth0Sub: auth0Sub || undefined,
      });
    } else {
      // si existe pero no tiene auth0Sub y ahora sí viene, lo guardamos
      if (!u.auth0Sub && auth0Sub) {
        u.auth0Sub = auth0Sub;
        await u.save();
      }
    }

    const roles = u.roles || [];
    const perms = u.perms || [];

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