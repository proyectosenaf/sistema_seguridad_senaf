// server/modules/rondasqr/routes/rondasqr.offline.routes.js
import express from "express";
import RqPoint from "../models/RqPoint.model.js";
import RqMark from "../models/RqMark.model.js";
import RqIncident from "../models/RqIncident.model.js";
import RqDevice from "../models/RqDevice.model.js"; // lo tienes en tu carpeta

const router = express.Router();

/**
 * Saca datos del oficial desde req.user o headers de dev
 */
function getOfficer(req) {
  const u = req?.user || {};
  return {
    officerEmail: u.email || req.headers["x-user-email"] || "",
    officerName: u.name || "",
    officerSub: u.sub || "",
  };
}

/**
 * GET /api/rondasqr/v1/offline/ping
 */
router.get("/offline/ping", (_req, res) => {
  res.json({ ok: true, where: "/api/rondasqr/v1/offline/ping", ts: Date.now() });
});

/**
 * POST /api/rondasqr/v1/offline/dump
 * Aquí aceptamos EL FORMATO QUE MANDA TU CLIENTE:
 * {
 *   outbox: [{ qr, gps, at, ... }],
 *   progress: { ... },
 *   device: { ... },
 *   at: "..."
 * }
 */
router.post("/offline/dump", async (req, res, next) => {
  try {
    const {
      outbox = [],
      progress = {},
      device = {},
      at = null,
    } = req.body || {};

    const { officerEmail, officerName, officerSub } = getOfficer(req);

    const saved = { marks: 0, incidents: 0, device: 0 };
    const errors = [];

    /* 1) procesar outbox -> lo tratamos como “marks offline” */
    for (const it of Array.isArray(outbox) ? outbox : []) {
      try {
        const qr = String(it.qr || "").trim();
        if (!qr) {
          errors.push({ kind: "mark", reason: "qr_missing", raw: it });
          continue;
        }

        // buscar el punto por cualquiera de los campos típicos
        const point = await RqPoint.findOne({
          active: true,
          $or: [{ qr }, { qrNo: qr }, { code: qr }],
        }).lean();

        if (!point) {
          errors.push({ kind: "mark", reason: "point_not_found", qr, raw: it });
          continue;
        }

        const hasGps =
          it.gps &&
          typeof it.gps.lat === "number" &&
          typeof it.gps.lon === "number";

        await RqMark.create({
          pointId: point._id,
          pointName: point.name || "",
          siteId: point.siteId || null,
          roundId: point.roundId || null,
          qr: point.qr || qr,
          qrNo: point.qrNo || undefined,
          at: it.at ? new Date(it.at) : new Date(),
          gps: it.gps || {},
          loc: hasGps
            ? {
                type: "Point",
                coordinates: [Number(it.gps.lon), Number(it.gps.lat)],
              }
            : undefined,
          deviceId: it.hardwareId || it.deviceId || null,
          message: it.message || "",
          officerEmail,
          officerName,
          officerSub,
        });

        saved.marks += 1;
      } catch (err) {
        errors.push({ kind: "mark", reason: err.message, raw: it });
      }
    }

    /* 2) si vino un progreso, lo guardamos en RqDevice como último estado */
    if (Object.keys(progress).length || Object.keys(device).length) {
      try {
        await RqDevice.findOneAndUpdate(
          {
            // identificamos el device por user o por userAgent si no hay nada más
            officerSub: officerSub || undefined,
            officerEmail: officerEmail || undefined,
          },
          {
            $set: {
              lastProgress: progress,
              lastDeviceInfo: device,
              lastDumpAt: at ? new Date(at) : new Date(),
            },
          },
          { upsert: true, new: true }
        ).lean();
        saved.device += 1;
      } catch (err) {
        errors.push({ kind: "device", reason: err.message });
      }
    }

    // (opcional) si en algún futuro quieres que también mande incidentes, aquí:
    // const { incidents = [] } = req.body; ...

    return res.json({
      ok: true,
      saved,
      errors,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
