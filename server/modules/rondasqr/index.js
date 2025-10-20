import express from "express";

import scanRoutes from "./routes/rondasqr.scan.routes.js";
import incidentsRoutes from "./routes/rondasqr.incidents.routes.js";
import reportsRoutes from "./routes/rondasqr.reports.routes.js";
import adminRoutes from "./routes/rondasqr.admin.routes.js";
import { raisePanic } from "./services/alerts.service.js";

const router = express.Router();

/* ─────────── Auth liviano del módulo (soporta DEV headers) ─────────── */
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";
const IAM_ALLOW_DEV_HEADERS = String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

function auth(req, res, next) {
  if ( DISABLE_AUTH ) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: req.headers["x-user-email"] || "dev@local",
      "https://senaf.local/roles": (req.headers["x-roles"] || "admin").split(","),
      permissions: (req.headers["x-perms"] || "").split(","),
    };
    return next();
  }
  if (IAM_ALLOW_DEV_HEADERS && req.headers["x-user-email"]) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: req.headers["x-user-email"],
      "https://senaf.local/roles": (req.headers["x-roles"] || "").split(","),
      permissions: (req.headers["x-perms"] || "").split(","),
    };
    return next();
  }
  if (req.user && (req.user.email || req.user.sub)) return next();
  return res.status(401).json({ message: "No autorizado" });
}

/* ──────────────── Rutas del módulo (prefijo se da en server.js) ─────────────── */
router.use("/admin",   auth, adminRoutes);      // /api/rondasqr/v1/admin/*
router.use("/checkin", auth, scanRoutes);       // /api/rondasqr/v1/checkin/*
router.use("/checkin", auth, incidentsRoutes);  // /api/rondasqr/v1/checkin/*
router.use("/reports", auth, reportsRoutes);    // /api/rondasqr/v1/reports/*

/* Botón de pánico directo */
router.post("/checkin/panic", auth, async (req, res) => {
  try {
    const guardId = req.user?.sub || "dev";
    const guardName = req.user?.email || "Anónimo";
    const gps = req.body?.gps;

    const loc =
      gps?.lat && gps?.lon
        ? { type: "Point", coordinates: [Number(gps.lon), Number(gps.lat)] }
        : undefined;

    const alert = await raisePanic({ guardId, guardName, loc });
    res.json({ ok: true, alertId: alert._id });
  } catch (err) {
    console.error("[rondasqr] panic error:", err);
    res.status(500).json({ ok: false, message: "Error al enviar alerta" });
  }
});

export default router;
