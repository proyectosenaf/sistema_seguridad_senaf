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

// carpeta donde se van a guardar las fotos de incidentes
const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// multer simple → guarda en disco
const upload = multer({
  dest: uploadDir,
});

// GET lista
router.get("/api/incidentes", getAllIncidents);

// POST crear (con fotos opcionales)
router.post(
  "/api/incidentes",
  upload.array("photos", 10),
  createIncident
);

// PUT actualizar estado u otros campos
router.put("/api/incidentes/:id", updateIncident);

export default router;
