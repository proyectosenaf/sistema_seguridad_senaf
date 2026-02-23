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

r.get("/context", async (req, res, next) => {
  try {
    mustActionsKey(req);

    const email = normEmail(req.query.email);
    if (!email) return res.status(400).json({ ok: false, error: "email requerido" });

    // Si existe en IAM => roles/perms reales
    const u = await IamUser.findOne({ email }).lean();

    if (!u) {
      // visitante (no existe en IAM)
      return res.json({ ok: true, email, roles: ["visita"], perms: [] });
    }

    // empleado/usuario interno
    const roles = Array.isArray(u.roles) ? u.roles : [];
    const perms = Array.isArray(u.perms) ? u.perms : [];

    return res.json({
      ok: true,
      email,
      roles: roles.length ? roles : ["visita"],
      perms,
      userId: String(u._id),
      provider: u.provider || "auth0",
      active: u.active !== false,
    });
  } catch (e) {
    next(e);
  }
});

export default r;