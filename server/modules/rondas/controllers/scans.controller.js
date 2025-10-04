// server/modules/rondas/controllers/scans.controller.js
import Scan from "../models/ScanEvent.model.js";
import CP from "../models/Checkpoint.model.js";
import Shift from "../models/PatrolShift.model.js";
import { emitAlert } from "../services/alert.service.js";
import { asyncWrap } from "../utils/async.util.js";

/**
 * POST /scans
 * body: { shiftId: string, qrPayload?: string, checkpointId?: string, geo?: {lat,lng,accuracy}, note?: string }
 */
export const registerScan = asyncWrap(async (req, res) => {
  const { shiftId, qrPayload, checkpointId, geo, note } = req.body;

  // --- Guard ID (funciona sin auth real aún) ---
  const guardId =
    req.user?.sub ||
    req.user?.id ||
    req.headers["x-guard-id"] ||
    req.headers["x-user-id"] || // compat
    "guard-ui";

  if (!shiftId) {
    return res.status(400).json({ ok: false, message: "shiftId es requerido" });
  }

  // --- Resolver checkpoint ---
  let cp = null;
  if (qrPayload) {
    cp = await CP.findOne({ qrPayload, active: true }).lean();
  } else if (checkpointId) {
    cp = await CP.findOne({ _id: checkpointId, active: true }).lean();
  }
  if (!cp) {
    return res.status(400).json({ ok: false, message: "Punto de control no reconocido" });
  }

  // --- Validar turno ---
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    return res.status(404).json({ ok: false, message: "Turno no encontrado" });
  }
  if (shift.status !== "active") {
    return res.status(400).json({ ok: false, message: "El turno no está activo" });
  }

  // Validar que el CP pertenece a la zona del turno (recomendado)
  if (String(shift.zoneId) !== String(cp.zoneId)) {
    return res.status(400).json({
      ok: false,
      message: "El punto de control no pertenece a la zona del turno",
    });
  }

  // --- Anti-duplicado corto (20s) ---
  const twentySecAgo = new Date(Date.now() - 20 * 1000);
  const dup = await Scan.findOne({
    shiftId,
    checkpointId: cp._id,
    at: { $gte: twentySecAgo },
  }).lean();
  if (dup) {
    return res.status(409).json({
      ok: false,
      message: "Escaneo ya registrado hace pocos segundos",
      last: dup,
    });
  }

  // --- Calcular SLA ---
  const startAt = shift.startAt || shift.createdAt || new Date();
  const expectedOffsetMs = Number(cp.expectedSecondsFromStart || 0) * 1000;
  const target = new Date(startAt.getTime() + expectedOffsetMs);

  const lateThresholdMs = Number(
    (cp.graceSeconds ?? shift.sla?.lateThresholdSeconds ?? 180)
  ) * 1000;

  const now = new Date();
  let slaStatus = "on_time"; // on_time | late
  if (now.getTime() - target.getTime() > lateThresholdMs) {
    slaStatus = "late";
  }

  // --- Normalizar geo ---
  const geoNorm =
    geo && typeof geo === "object"
      ? {
          lat: typeof geo.lat === "number" ? geo.lat : undefined,
          lng: typeof geo.lng === "number" ? geo.lng : undefined,
          accuracy: typeof geo.accuracy === "number" ? geo.accuracy : undefined,
        }
      : undefined;

  // --- Persistir evento ---
  const ev = await Scan.create({
    shiftId,
    checkpointId: cp._id,
    guardId,
    at: now,
    geo: geoNorm,
    note: typeof note === "string" ? note.slice(0, 500) : undefined,
    slaStatus,
  });

  // --- Alerta en tiempo real ---
  emitAlert("rondas:scan", {
    shiftId,
    checkpointId: String(cp._id),
    at: ev.at,
    slaStatus,
    guardId,
  });

  return res.status(201).json({ ok: true, event: ev });
});
