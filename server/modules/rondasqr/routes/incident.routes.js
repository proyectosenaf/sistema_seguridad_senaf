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

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
});

/**
 * Queremos que esto funcione en distintos montajes:
 *
 * - app.use(incidentRoutes);                      -> necesitamos rutas con prefijo /api/...
 * - app.use("/api", incidentRoutes);             -> necesitamos rutas SIN /api al principio
 * - app.use("/api/rondasqr/v1", incidentRoutes); -> necesitamos rutas relativas a /incidentes
 *
 * Por eso registramos varias rutas alias que apuntan a los mismos handlers.
 */

/* ===== LISTAR INCIDENTES ===== */

// Versión absoluta (por si el router se monta en "/")
router.get("/api/rondasqr/v1/incidentes", getAllIncidents);
// Versión relativa a "/api"
router.get("/rondasqr/v1/incidentes", getAllIncidents);
// Versión genérica para el módulo central: "/api/incidentes"
router.get("/incidentes", getAllIncidents);

/* ===== CREAR INCIDENTE (con fotos) ===== */

// Absoluta
router.post(
  "/api/rondasqr/v1/incidentes",
  upload.array("photos", 10),
  createIncident
);
// Relativa a "/api"
router.post(
  "/rondasqr/v1/incidentes",
  upload.array("photos", 10),
  createIncident
);
// Módulo central "/api/incidentes"
router.post("/incidentes", upload.array("photos", 10), createIncident);

/* ===== ACTUALIZAR INCIDENTE ===== */

// Absoluta
router.put("/api/rondasqr/v1/incidentes/:id", updateIncident);
// Relativa a "/api"
router.put("/rondasqr/v1/incidentes/:id", updateIncident);
// Módulo central "/api/incidentes/:id"
router.put("/incidentes/:id", updateIncident);

export default router;
