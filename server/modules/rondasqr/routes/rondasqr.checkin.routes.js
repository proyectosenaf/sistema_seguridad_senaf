// server/modules/rondasqr/routes/rondasqr.checkin.routes.js
import express from "express";
import RqIncident from "../models/RqIncident.model.js";
// (si ya existe router, no dupliques)
const router = express.Router();

/* ========= NUEVO: Inmovilidad =========
   body: {
     minutes: number,           // minutos inmóvil
     steps?: number,            // pasos acumulados
     gps?: { lat, lon },        // coords
     siteId?, siteName?, roundId?, roundName?, pointId?, pointName?
   }
*/
router.post("/inactivity", async (req, res, next) => {
  try {
    const b = req.body || {};
    const at = new Date();

    const doc = await RqIncident.create({
      type: "inactivity",
      text: `Inmovilidad de ${b.minutes ?? "?"} minutos`,
      siteId: b.siteId || null,
      siteName: b.siteName || "",
      roundId: b.roundId || null,
      roundName: b.roundName || "",
      pointId: b.pointId || "",
      pointName: b.pointName || "",
      officerName: req?.auth?.payload?.name || "",
      officerEmail: req?.auth?.payload?.email || "",
      at,
      gps: b.gps || {},
      durationMin: Number(b.minutes ?? 0) || 0,
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
    });

    // Emite a la central por Socket.IO si está disponible
    req.io?.emit?.("rondasqr:alert", { kind: "inactivity", item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ========= NUEVO: Hombre Caído =========
   body: {
     afterInactivityMin?: number, // minutos previos sin moverse
     gps?: { lat, lon },
     steps?: number
   }
*/
router.post("/fall", async (req, res, next) => {
  try {
    const b = req.body || {};
    const at = new Date();

    const doc = await RqIncident.create({
      type: "fall",
      text: `Hombre caído${b.afterInactivityMin ? ` tras ${b.afterInactivityMin} min de inmovilidad` : ""}`,
      officerName: req?.auth?.payload?.name || "",
      officerEmail: req?.auth?.payload?.email || "",
      at,
      gps: b.gps || {},
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
      fallDetected: true,
    });

    req.io?.emit?.("rondasqr:alert", { kind: "fall", item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

export default router;
