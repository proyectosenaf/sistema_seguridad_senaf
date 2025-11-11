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

// 👇 AHORA sí ponemos el prefijo de API de RONDAS
router.get("/api/rondasqr/v1/incidentes", getAllIncidents);

// acepta fotos
router.post(
  "/api/rondasqr/v1/incidentes",
  upload.array("photos", 10),
  createIncident
);

router.put("/api/rondasqr/v1/incidentes/:id", updateIncident);

export default router;
