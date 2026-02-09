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

import { optionalAuth, attachAuthUser } from "../../../src/middleware/auth.js";
import { requirePermission } from "../../../src/middleware/permissions.js";

const router = express.Router();

/* ───────────────── Upload config ───────────────── */
const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

/* ───────────────── Auth base ─────────────────
   - optionalAuth: si llega Bearer valida, si no, pasa (útil DEV/visitor)
   - attachAuthUser: normaliza req.user desde req.auth.payload
   NOTA: Si quieres obligar token siempre, cambia optionalAuth -> requireAuth
*/
router.use(optionalAuth, attachAuthUser);

/**
 * Permisos usados:
 *  - incidentes.read
 *  - incidentes.create
 *  - incidentes.edit
 *
 * Ajusta estos keys a como los tengas en tu IAM.
 */

/* =========================================================
   LISTAR INCIDENTES
   GET /api/incidentes?limit=500
   ========================================================= */
router.get(
  "/",
  requirePermission("incidentes.read", "incidentes.reports", "*"),
  getAllIncidents
);

/* =========================================================
   CREAR INCIDENTE
   POST /api/incidentes   (multipart: photos[])
   ========================================================= */
router.post(
  "/",
  requirePermission("incidentes.create", "*"),
  upload.array("photos", 10),
  createIncident
);

/* =========================================================
   ACTUALIZAR INCIDENTE
   PUT /api/incidentes/:id
   ========================================================= */
router.put(
  "/:id",
  requirePermission("incidentes.edit", "*"),
  updateIncident
);

export default router;
