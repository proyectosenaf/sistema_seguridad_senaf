import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";

import {
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident, // ✅ IMPORTAR
} from "../controllers/incident.controller.js";

import { requirePermission } from "../../../src/middleware/permissions.js";

const router = express.Router();

/* ───────────────── Upload config ───────────────── */
const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

/**
 * NOTA:
 * Auth (optionalAuth + attachAuthUser) ya corre globalmente en server.js
 * antes de montar rutas, así que aquí no lo repetimos.
 */

/* LISTAR: GET /api/incidentes?limit=500 */
router.get(
  "/",
  requirePermission("incidentes.read", "incidentes.reports", "*"),
  getAllIncidents
);

/* CREAR: POST /api/incidentes */
router.post(
  "/",
  requirePermission("incidentes.create", "*"),
  upload.array("photos", 10),
  createIncident
);

/* ACTUALIZAR: PUT /api/incidentes/:id */
router.put(
  "/:id",
  requirePermission("incidentes.edit", "*"),
  updateIncident
);

/* ✅ ELIMINAR: DELETE /api/incidentes/:id */
router.delete(
  "/:id",
  requirePermission("incidentes.delete", "incidentes.edit", "*"),
  deleteIncident
);

export default router;
