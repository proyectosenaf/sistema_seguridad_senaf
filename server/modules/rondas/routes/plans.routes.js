import { Router } from "express";
import { requireAuth, requireRole } from "../utils/auth.util.js";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from "../controllers/plans.controller.js";

const r = Router();

// Listar planes (opcional: ?zoneId=... & ?active=true|false)
r.get("/", requireAuth, listPlans);

// Crear, actualizar y eliminar (solo admin)
r.post("/",    requireAuth, requireRole("admin"), createPlan);
r.put("/:id",  requireAuth, requireRole("admin"), updatePlan);
r.delete("/:id", requireAuth, requireRole("admin"), deletePlan);

export default r;
