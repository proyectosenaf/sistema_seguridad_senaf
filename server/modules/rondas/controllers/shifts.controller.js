// server/modules/rondas/controllers/shifts.controller.js
import Shift from "../models/PatrolShift.model.js";
import CP from "../models/Checkpoint.model.js";
import Scan from "../models/ScanEvent.model.js";

// Si tienes un servicio de alertas vía Socket.IO, déjalo importado;
// si no lo tienes aún, puedes comentar la línea y las llamadas.
import { emitAlert } from "../services/alert.service.js";

/**
 * POST /shifts/start  { zoneId }
 */
export async function startShift(req, res) {
  try {
    const { zoneId } = req.body;
    if (!zoneId) return res.status(400).json({ message: "zoneId es requerido" });

    const guardId = req.user?.sub || req.headers["x-user-id"] || "guard-ui";

    // Evitar turno activo duplicado del mismo guardia
    const existing = await Shift.findOne({ guardId, status: "active" }).lean();
    if (existing) {
      return res.status(409).json({ message: "Ya hay un turno activo", shiftId: existing._id });
    }

    // Construir expectedOrder a partir de checkpoints activos en la zona
    const cps = await CP.find({ zoneId, active: true }).sort({ order: 1 }).lean();
    if (!cps.length) return res.status(400).json({ message: "La zona no tiene puntos activos" });

    const shift = await Shift.create({
      zoneId,
      guardId,
      status: "active",
      startAt: new Date(),
      expectedOrder: cps.map(c => c._id),
      // opcional: sla: { lateThresholdSeconds: 180 }
    });

    try { emitAlert?.("rondas:shift:start", { shiftId: shift._id, zoneId, guardId, at: shift.startAt, expectedCount: cps.length }); } catch {}

    res.status(201).json(shift);
  } catch (e) {
    console.error("[startShift]", e);
    res.status(500).json({ message: "error" });
  }
}

/**
 * POST /shifts/:id/end
 */
export async function endShift(req, res) {
  try {
    const { id } = req.params;
    const shift = await Shift.findById(id).populate("expectedOrder").lean();
    if (!shift) return res.status(404).json({ message: "Turno no encontrado" });

    // Calcular omitidos (missed)
    const scans = await Scan.find({ shiftId: id }).lean();
    const scanned = new Set(scans.map(s => String(s.checkpointId)));
    const missed = (shift.expectedOrder || []).filter(cp => !scanned.has(String(cp._id)));

    const updated = await Shift.findByIdAndUpdate(
      id,
      { status: "completed", endAt: new Date() },
      { new: true }
    ).lean();

    try { emitAlert?.("rondas:shift:end", {
      shiftId: updated?._id,
      zoneId: updated?.zoneId,
      guardId: updated?.guardId,
      at: updated?.endAt,
      totals: { expected: shift.expectedOrder?.length || 0, scanned: scans.length, missed: missed.length },
    }); } catch {}

    res.json({
      ...updated,
      summary: { expected: shift.expectedOrder?.length || 0, scanned: scans.length, missed: missed.length },
    });
  } catch (e) {
    console.error("[endShift]", e);
    res.status(500).json({ message: "error" });
  }
}

/**
 * (opcional) POST /shifts/schedule
 */
export async function scheduleShift(_req, res) {
  res.status(501).json({ message: "schedule no implementado" });
}
