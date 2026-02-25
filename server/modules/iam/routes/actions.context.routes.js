// server/modules/iam/routes/actions.context.routes.js
import { Router } from "express";
import IamUser from "../models/IamUser.model.js";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function mustActionsKey(req) {
  const expected = String(process.env.SENAF_ACTIONS_KEY || "").trim();
  const got = String(req.header("x-actions-key") || "").trim();
  if (!expected || got !== expected) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

/**
 * GET /api/iam/v1/actions/context?email=...
 * - Lo llama Auth0 Action (Post Login)
 * - Devuelve roles/perms + mustReset (si debe forzar cambio de clave)
 */
r.get("/context", async (req, res, next) => {
  try {
    mustActionsKey(req);

    const email = normEmail(req.query.email);
    if (!email) return res.status(400).json({ ok: false, error: "email requerido" });

    const u = await IamUser.findOne({ email }).lean();

    // Visitante (no existe en IAM)
    if (!u) {
      return res.json({
        ok: true,
        email,
        roles: ["visita"],
        perms: [],
        mustReset: false,
        provider: "auth0",
        active: true,
      });
    }

    const active = u.active !== false;

    // Si está desactivado: no permisos/roles (se comporta como visita)
    const roles = active && Array.isArray(u.roles) ? u.roles : [];
    const perms = active && Array.isArray(u.perms) ? u.perms : [];

    // ✅ bandera que usará la Action
    const mustReset = active && u.mustChangePassword === true;

    return res.json({
      ok: true,
      email,
      roles: roles.length ? roles : ["visita"],
      perms,
      mustReset,
      userId: String(u._id),
      provider: u.provider || "auth0",
      active,
    });
  } catch (e) {
    next(e);
  }
});

export default r;