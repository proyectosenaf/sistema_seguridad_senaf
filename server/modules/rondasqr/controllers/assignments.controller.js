// server/modules/rondasqr/controllers/assignments.controller.js
import mongoose from "mongoose";
import RqAssignment from "../models/RqAssignment.model.js";
import RqSite from "../models/RqSite.model.js";
import RqRound from "../models/RqRound.model.js";

/**
 * Crear nueva asignación de ronda (compat)
 */
export async function createAssignment(req, res) {
  try {
    const {
      date,
      siteId,
      roundId,
      guardId,
      guardUserId,
      startTime,
      alertTime, // si tu UI lo usa
      endTime,   // si lo mandan
    } = req.body || {};

    const guard = (typeof guardId === "string" && guardId.trim())
      ? guardId.trim()
      : (typeof guardUserId === "string" && guardUserId.trim())
      ? guardUserId.trim()
      : "";

    if (!siteId || !roundId || !guard) {
      return res.status(400).json({ ok: false, error: "Faltan campos obligatorios" });
    }

    const doc = await RqAssignment.create({
      date: typeof date === "string" ? date.trim() : date,
      siteId: mongoose.Types.ObjectId.isValid(siteId) ? new mongoose.Types.ObjectId(siteId) : siteId,
      roundId: mongoose.Types.ObjectId.isValid(roundId) ? new mongoose.Types.ObjectId(roundId) : roundId,

      // ✅ canónico + compat
      guardId: guard,
      guardUserId: guard,

      startTime,
      // compat: algunos usan alertTime como “fin/alerta”
      endTime: endTime || alertTime || null,

      status: "assigned",
    });

    const site = await RqSite.findById(siteId).lean();
    const round = await RqRound.findById(roundId).lean();

    const notifier = req.app.get("notifier");
    if (notifier?.assignment) {
      await notifier.assignment({
        userId: guard,
        email: null,
        siteName: site?.name || "Sitio",
        roundName: round?.name || "Ronda",
        startTime: doc?.startTime || startTime || null,
        endTime: doc?.endTime || endTime || alertTime || null,
        assignmentId: doc._id?.toString(),
      });
    }

    res.status(201).json({ ok: true, assignment: doc });
  } catch (e) {
    console.error("[createAssignment]", e);
    res.status(500).json({ ok: false, error: e.message || "Error interno" });
  }
}

/**
 * Listar asignaciones del día (compat)
 */
export async function listAssignments(req, res) {
  try {
    const date = typeof req.query.date === "string" ? req.query.date.trim() : "";
    const query = date ? { date } : {};

    const items = await RqAssignment.find(query)
      .populate("siteId", "name")
      .populate("roundId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * Eliminar asignación
 */
export async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;
    await RqAssignment.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
