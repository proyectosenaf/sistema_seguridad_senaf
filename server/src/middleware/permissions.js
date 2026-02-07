// server/modules/incidentes/routes/incident.routes.js
import express from "express";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
} from "../controllers/incident.controller.js";
import { requireAuth, requireAdmin } from "../../../src/middleware/auth.js";

const router = express.Router();

/**
 * IMPORTANTE:
 * En dev con DISABLE_AUTH=1, requireAuth no valida JWT (pasa),
 * pero requireAdmin debe poder leer identidad desde req.user.
 * Esa corrección se hace en server/src/middleware/auth.js (abajo).
 */

// Todas las rutas de este módulo exigen estar autenticado (o bypass si DISABLE_AUTH=1)
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
// Si necesitas permisos más específicos, puedes crear middlewares adicionales similares a requireAdmin.
// Si quieres más control, puedes hacer un middleware por rol, o por propiedad del recurso, etc.
// Ejemplo: requireRole("admin"), o requireOwnership(model, "createdBy.sub"), etc.
// También puedes usar algo como casl o accesscontrol para RBAC/ABAC más avanzado.
// Más info: https://auth0.com/docs/authorization/rbac/implementation/nodejs-express   