// server/modules/incidentes/routes/incident.routes.js
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
} from "../controllers/incident.controller.js";

import { requireAuth, requireAdmin } from "../../../src/middleware/auth.js";

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

// Todas las rutas exigen estar autenticado
router.use(requireAuth);

/* LISTAR */
router.get("/api/rondasqr/v1/incidentes", requireAdmin, getAllIncidents);
router.get("/rondasqr/v1/incidentes", requireAdmin, getAllIncidents);
router.get("/incidentes", requireAdmin, getAllIncidents);

/* CREAR */
router.post(
  "/api/rondasqr/v1/incidentes",
  requireAdmin,
  upload.array("photos", 10),
  createIncident
);
router.post(
  "/rondasqr/v1/incidentes",
  requireAdmin,
  upload.array("photos", 10),
  createIncident
);
router.post(
  "/incidentes",
  requireAdmin,
  upload.array("photos", 10),
  createIncident
);

/* ACTUALIZAR */
router.put("/api/rondasqr/v1/incidentes/:id", requireAdmin, updateIncident);
router.put("/rondasqr/v1/incidentes/:id", requireAdmin, updateIncident);
router.put("/incidentes/:id", requireAdmin, updateIncident);

export default router;
