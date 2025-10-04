import { Router } from "express";
import { startShift, endShift, scheduleShift } from "../controllers/shifts.controller.js";

// Stubs simples de auth para dev (si ya tienes globales, importa los tuyos)
function requireAuth(req, _res, next) {
  if (!req.user) {
    const uid = req.headers["x-user-id"] || "guard-ui";
    const roles = String(req.headers["x-roles"] || "").split(",").map(s => s.trim()).filter(Boolean);
    req.user = { sub: uid, roles };
  }
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const ok = Array.isArray(roles) ? roles.includes(role) : String(roles) === role;
    if (!ok) return res.status(403).json({ ok:false, message:"Forbidden" });
    next();
  };
}

const r = Router();
r.post("/schedule", requireAuth, requireRole("admin"), scheduleShift);
r.post("/start", requireAuth, startShift);
r.post("/:id/end", requireAuth, endShift);
export default r;
