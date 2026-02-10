// server/modules/rondasqr/controllers/offline.controller.js

import RqPoint from "../models/RqPoint.model.js";
import RqMark from "../models/RqMark.model.js";
import RqIncident from "../models/RqIncident.model.js"; // por si luego mandas incidentes
import RqDevice from "../models/RqDevice.model.js";

/**
 * Devuelve datos básicos del oficial/usuario que hace el dump
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
export function offlinePing(_req, res) {
  res.json({ ok: true, where: "/api/rondasqr/v1/offline/ping", ts: Date.now() });
}

/**
 * POST /api/rondasqr/v1/offline/checkin
 * versión corta: un solo check-in offline
 */
export async function postOfflineCheckin(req, res, next) {
  try {
    const { qr, gps, at } = req.body || {};
    if (!qr) {
      return res.status(400).json({ ok: false, error: "qr_required" });
    }

    const { officerEmail, officerName, officerSub } = getOfficer(req);

    const point = await RqPoint.findOne({
      active: true,
      $or: [{ qr }, { qrNo: qr }, { code: qr }],
    }).lean();

    if (!point) {
      return res.status(404).json({ ok: false, error: "point_not_found" });
    }

    const hasGps =
      gps && typeof gps.lat === "number" && typeof gps.lon === "number";

    await RqMark.create({
      pointId: point._id,
      pointName: point.name || "",
      siteId: point.siteId || null,
      roundId: point.roundId || null,
      qr: point.qr || qr,
      qrNo: point.qrNo || undefined,
      at: at ? new Date(at) : new Date(),
      gps: gps || {},
      loc: hasGps
        ? {
            type: "Point",
            coordinates: [Number(gps.lon), Number(gps.lat)],
          }
        : undefined,
      deviceId: req.body?.hardwareId || req.body?.deviceId || null,
      officerEmail,
      officerName,
      officerSub,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rondasqr/v1/offline/dump
 * Formato que envía tu front:
 * {
 *   outbox: [{ qr, gps, at, ... }],
 *   progress: {...},
 *   device: {...},
 *   at: "..."
 * }
 */
export async function postOfflineDump(req, res, next) {
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

    // 1) procesar los check-ins pendientes
    for (const it of Array.isArray(outbox) ? outbox : []) {
      try {
        const qr = String(it.qr || "").trim();
        if (!qr) {
          errors.push({ kind: "mark", reason: "qr_missing", raw: it });
          continue;
        }

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

    // 2) guardar estado del dispositivo / progreso
    if (Object.keys(progress).length || Object.keys(device).length) {
      try {
        await RqDevice.findOneAndUpdate(
          {
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

    return res.json({
      ok: true,
      saved,
      errors,
    });
  } catch (err) {
    next(err);
  }
}
