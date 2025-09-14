import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/common.js";
import * as ctrl from "../controllers/supervision.controller.js";

const r = Router();
r.use(requireAuth);

// registros
r.get("/", ctrl.list);
r.post("/", ctrl.create);
r.patch("/:id", validate(idParam), ctrl.update);
r.delete("/:id", validate(idParam), ctrl.remove);
r.patch("/:id/cerrar", validate(idParam), ctrl.cerrar);
r.patch("/:id/reabrir", validate(idParam), ctrl.reabrir);

// planes
r.get("/plans", ctrl.listPlans);
r.post("/plans", ctrl.createPlan);
r.patch("/plans/:id", validate(idParam), ctrl.updatePlan);
r.delete("/plans/:id", validate(idParam), ctrl.removePlan);
r.post("/plans/run", ctrl.runPlans);  // ?date=YYYY-MM-DD

export default r; 