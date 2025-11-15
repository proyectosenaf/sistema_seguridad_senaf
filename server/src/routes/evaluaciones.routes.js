// server/src/routes/evaluaciones.routes.js
import { Router } from "express";
import {
  getMetricaPorEmpleado,
  getHistorial,
  crear,
  actualizar,
  eliminar,
} from "../controllers/evaluaciones.controller.js";

const router = Router();

// Métricas por empleado (paneles)
router.get("/", getMetricaPorEmpleado);

// Historial (tabla)
router.get("/historial", getHistorial);

// CRUD
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", eliminar);

export default router;

