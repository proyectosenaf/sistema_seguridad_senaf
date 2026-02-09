// server/modules/rondasqr/routes/incident.routes.js

import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";

import {
  getAllIncidents,
  createIncident,
  updateIncident,
} from "../controllers/incident.controller.js";

import {
  requireAuth,
  attachUser,
} from "../../../src/middleware/auth.js";

import {
  requirePermission,
} from "../../../src/middleware/permissions.js";

const router = express.Router();

/* ───────────────── Upload config ───────────────── */

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

/* ───────────────── Middlewares base ───────────────── */

router.use(requireAuth, attachUser);

/**
 * Permisos usados:
 *  - incidentes.read
 *  - incidentes.create
 *  - incidentes.edit
 */

/* =========================================================
   LISTAR INCIDENTES
   ========================================================= */

// Absoluta
router.get(
  "/api/rondasqr/v1/incidentes",
  requirePermission("incidentes.read", "incidentes.reports", "*"),
  getAllIncidents
);

// Relativa a "/api"
router.get(
  "/rondasqr/v1/incidentes",
  requirePermission("incidentes.read", "incidentes.reports", "*"),
  getAllIncidents
);

// Módulo central
router.get(
  "/incidentes",
  requirePermission("incidentes.read", "incidentes.reports", "*"),
  getAllIncidents
);

/* =========================================================
   CREAR INCIDENTE
   ========================================================= */

router.post(
  "/api/rondasqr/v1/incidentes",
  requirePermission("incidentes.create", "*"),
  upload.array("photos", 10),
  createIncident
);

router.post(
  "/rondasqr/v1/incidentes",
  requirePermission("incidentes.create", "*"),
  upload.array("photos", 10),
  createIncident
);

router.post(
  "/incidentes",
  requirePermission("incidentes.create", "*"),
  upload.array("photos", 10),
  createIncident
);

/* =========================================================
   ACTUALIZAR INCIDENTE
   ========================================================= */

router.put(
  "/api/rondasqr/v1/incidentes/:id",
  requirePermission("incidentes.edit", "*"),
  updateIncident
);

router.put(
  "/rondasqr/v1/incidentes/:id",
  requirePermission("incidentes.edit", "*"),
  updateIncident
);

router.put(
  "/incidentes/:id",
  requirePermission("incidentes.edit", "*"),
  updateIncident
);

export default router;
