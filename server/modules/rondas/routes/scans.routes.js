// server/modules/rondas/routes/scans.routes.js
import { Router } from "express";

// ✅ ruta corregida (usa el utils dentro del módulo rondas)
import { requireAuth } from "../utils/auth.util.js";
import { registerScan } from "../controllers/scans.controller.js";

const r = Router();

// Registrar escaneo de un punto (QR)
r.post("/", requireAuth, registerScan);

export default r;
