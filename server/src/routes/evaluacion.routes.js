import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/common.js";
import { listQuery, createEval, updateEval, syncBody } from "../validators/evaluacion.js";
import * as ctrl from "../controllers/evaluacion.controller.js";

const r = Router();
r.use(requireAuth);

// GET /api/evaluacion?periodo=YYYY-MM&q=&page=&limit=
r.get("/", validate(listQuery), ctrl.list);

// POST /api/evaluacion  (crear manual)
r.post("/", createEval, validate(), ctrl.create);

// POST /api/evaluacion/sync  { periodo: "YYYY-MM" }  ← promedia supervisiones cerradas
r.post("/sync", syncBody, validate(), ctrl.syncFromSupervision);

// REST
r.get("/:id", idParam, validate(), ctrl.getById);
r.patch("/:id", idParam, updateEval, validate(), ctrl.update);
r.delete("/:id", idParam, validate(), ctrl.remove);

export default r;
// ⬇️ pequeño wrapper para capturar errores async y evitar que el proceso caiga
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// ⬇️ ejemplo de uso en una ruta (GET /api/evaluacion)