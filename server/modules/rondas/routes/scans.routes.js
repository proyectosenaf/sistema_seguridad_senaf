// server/modules/rondas/routes/scans.routes.js
import { Router } from "express";
import { requireAuth } from "../utils/auth.util.js";
import { registerScan } from "../controllers/scans.controller.js";

const r = Router();

// Valida lo básico sin imponer formato estricto (el controlador puede validar más)
function validateScanBody(req, res, next) {
  const { shiftId, checkpointId } = req.body || {};
  if (!shiftId || !checkpointId) {
    return res.status(400).json({
      ok: false,
      error: "Faltan shiftId y/o checkpointId",
    });
  }
  return next();
}

// Registrar escaneo de un punto (QR)
r.post("/", requireAuth, validateScanBody, registerScan);

export default r;
