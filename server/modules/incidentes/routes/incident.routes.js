// server/modules/incidentes/routes/incident.routes.js
import express from "express";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
} from "../controllers/incident.controller.js";

import { requireAuth, attachUser } from "../../../src/middleware/auth.js";
import { requirePermission } from "../../../src/middleware/permissions.js";

const router = express.Router();

/**
 * ✅ Importante:
 * - requireAuth valida JWT (o bypass si DISABLE_AUTH=1)
 * - attachUser copia payload -> req.user
 */
router.use(requireAuth, attachUser);

/**
 * ✅ Permisos granulares (NO admin-only)
 * Ajusta los nombres para que coincidan con los que tú ya creaste:
 * - incidentes.read / incidentes.create / incidentes.edit / incidentes.delete
 * (si no tienes delete, usa "*" o crea el permiso)
 */
router.get("/", requirePermission("incidentes.read", "incidentes.reports", "*"), getAllIncidents);

router.post("/", requirePermission("incidentes.create", "*"), createIncident);

router.put("/:id", requirePermission("incidentes.edit", "*"), updateIncident);

router.delete("/:id", requirePermission("incidentes.delete", "*"), deleteIncident);

export default router;
