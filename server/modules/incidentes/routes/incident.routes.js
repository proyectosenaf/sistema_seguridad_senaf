// server/modules/incidentes/routes/incident.routes.js
import express from "express";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
} from "../controllers/incident.controller.js";
import {
  requireAuth,
  requireAdmin,
} from "../../../src/middleware/auth.js";

const router = express.Router();

// Todas las rutas de este módulo exigen estar autenticado
router.use(requireAuth);

// Listar incidentes (solo admin)
router.get("/", requireAdmin, getAllIncidents);

// Crear incidente (solo admin)
router.post("/", requireAdmin, createIncident);

// Actualizar incidente (solo admin)
router.put("/:id", requireAdmin, updateIncident);

// Eliminar incidente (solo admin)
router.delete("/:id", requireAdmin, deleteIncident);

export default router;
