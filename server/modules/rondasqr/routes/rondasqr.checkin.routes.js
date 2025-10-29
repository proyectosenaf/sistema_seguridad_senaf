// server/modules/rondasqr/routes/rondasqr.checkin.routes.js
import express from "express";
import RqPoint from "../models/RqPoint.model.js";
import RqPlan from "../models/RqPlan.model.js";
import RqMark from "../models/RqMark.model.js";
import RqIncident from "../models/RqIncident.model.js";

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
   Helper: tomar datos del oficial desde req.user (auth) o headers DEV
   ────────────────────────────────────────────────────────────── */
function getOfficer(req) {
  const u = req?.user || {};
  return {
    officerEmail: u.email || req.headers["x-user-email"] || "",
    officerName: u.name || "",
    officerSub: u.sub || "",
  };
}

/* =========================================================================
   SCAN (registrar punto)
   POST /api/rondasqr/v1/checkin/scan
   body: { qr: string, hardwareId?, gps?:{lat,lon,acc}, ts?, message?, steps? }
   resp: { ok, point:{_id,name,...}, markId, nextName?, progressPct? }
   ========================================================================= */
router.post("/scan", async (req, res, next) => {
  try {
    const { qr, hardwareId, gps, ts, message, steps } = req.body || {};
    if (!qr || typeof qr !== "string") {
      return res.status(400).json({ ok: false, error: "qr_required" });
    }

    // Soporta distintos campos de identificación del punto (qr | qrNo | code)
    const point = await RqPoint.findOne({
      active: true,
      $or: [{ qr }, { qrNo: qr }, { code: qr }],
    }).lean();

    if (!point) return res.status(404).json({ ok: false, error: "point_not_found" });

    // Crear marca (check-in)
    const { officerEmail, officerName, officerSub } = getOfficer(req);
    const hasGps = gps && typeof gps.lat === "number" && typeof gps.lon === "number";

    const mark = await RqMark.create({
      pointId: point._id,
      pointName: point.name || "",
      siteId: point.siteId || null,
      roundId: point.roundId || null,

      // mantener ambos por compatibilidad con esquemas previos
      qr: point.qr || qr,
      qrNo: point.qrNo || undefined,

      at: ts ? new Date(ts) : new Date(),
      gps: gps || {},
      loc: hasGps ? { type: "Point", coordinates: [Number(gps.lon), Number(gps.lat)] } : undefined,

      deviceId: hardwareId || null,
      message: message || "",
      steps: typeof steps === "number" ? steps : undefined,

      officerEmail,
      officerName,
      officerSub,

      // campos opcionales adicionales de tu schema pueden ir aquí...
    });

    // Calcular "siguiente" y % de progreso a partir del plan (si existe)
    let nextName = null;
    let progressPct = 0;

    if (point.siteId && point.roundId) {
      const plan = await RqPlan.findOne({ siteId: point.siteId, roundId: point.roundId }).lean();
      const seq = Array.isArray(plan?.pointIds) ? plan.pointIds.map(String) : [];
      if (seq.length) {
        const idx = seq.indexOf(String(point._id));
        if (idx >= 0) {
          progressPct = Math.round(((idx + 1) / seq.length) * 100);
          const nextId = seq[idx + 1] || null;
          if (nextId) {
            const nextPoint = await RqPoint.findById(nextId).lean();
            nextName = nextPoint?.name || null;
          }
        }
      }
    }

    res.json({ ok: true, point, markId: mark._id, nextName, progressPct });
  } catch (e) {
    next(e);
  }
});

/* =========================================================================
   INCIDENTES MANUALES
   POST /api/rondasqr/v1/checkin/incidents
   body: { text, lat?, lon?, gps?, photosBase64? }
   ========================================================================= */
router.post("/incidents", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.text) return res.status(400).json({ ok: false, error: "text_required" });

    const { officerEmail, officerName, officerSub } = getOfficer(req);
    const gps = (b.lat && b.lon) ? { lat: b.lat, lon: b.lon } : (b.gps || {});

    const doc = await RqIncident.create({
      type: "message",
      text: b.text,
      photosBase64: Array.isArray(b.photosBase64) ? b.photosBase64.slice(0, 10) : [],
      gps,
      at: new Date(),
      officerEmail,
      officerName,
      officerSub,
    });

    req.io?.emit?.("rondasqr:incident", { kind: "message", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* =========================================================================
   PÁNICO
   POST /api/rondasqr/v1/checkin/panic
   body: { gps? }
   ========================================================================= */
router.post("/panic", async (req, res, next) => {
  try {
    const { gps } = req.body || {};
    const { officerEmail, officerName, officerSub } = getOfficer(req);

    const doc = await RqIncident.create({
      type: "panic",
      text: "Botón de pánico",
      gps: gps || {},
      at: new Date(),
      officerEmail,
      officerName,
      officerSub,
    });

    req.io?.emit?.("rondasqr:alert", { kind: "panic", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* =========================================================================
   INACTIVIDAD
   POST /api/rondasqr/v1/checkin/inactivity
   body: { minutes, steps?, gps?, siteId?, siteName?, roundId?, roundName?, pointId?, pointName? }
   ========================================================================= */
router.post("/inactivity", async (req, res, next) => {
  try {
    const b = req.body || {};
    const { officerEmail, officerName, officerSub } = getOfficer(req);

    const doc = await RqIncident.create({
      type: "inactivity",
      text: `Inmovilidad de ${b.minutes ?? "?"} minutos`,
      gps: b.gps || {},
      at: new Date(),
      durationMin: Number(b.minutes ?? 0) || 0,
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
      siteId: b.siteId || null,
      siteName: b.siteName || "",
      roundId: b.roundId || null,
      roundName: b.roundName || "",
      pointId: b.pointId || null,
      pointName: b.pointName || "",
      officerEmail,
      officerName,
      officerSub,
    });

    req.io?.emit?.("rondasqr:alert", { kind: "inactivity", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* =========================================================================
   HOMBRE CAÍDO
   POST /api/rondasqr/v1/checkin/fall
   body: { afterInactivityMin?, steps?, gps? }
   ========================================================================= */
router.post("/fall", async (req, res, next) => {
  try {
    const b = req.body || {};
    const { officerEmail, officerName, officerSub } = getOfficer(req);

    const doc = await RqIncident.create({
      type: "fall",
      text: `Hombre caído${b.afterInactivityMin ? ` tras ${b.afterInactivityMin} min de inmovilidad` : ""}`,
      gps: b.gps || {},
      at: new Date(),
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
      fallDetected: true,
      officerEmail,
      officerName,
      officerSub,
    });

    req.io?.emit?.("rondasqr:alert", { kind: "fall", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

export default router;
