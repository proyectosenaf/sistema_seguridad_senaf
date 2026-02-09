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
  attachUser,
  requireAdmin
} from "../../../src/middleware/auth.js";

const router = express.Router();

/**
 * Todas las rutas:
 * 1) JWT válido
 * 2) Usuario inyectado en req.user
 */
router.use(requireAuth);
router.use(attachUser);

/**
 * SOLO ADMIN
 */
router.get("/", requireAdmin, getAllIncidents);
router.post("/", requireAdmin, createIncident);
router.put("/:id", requireAdmin, updateIncident);
router.delete("/:id", requireAdmin, deleteIncident);

export default router;
