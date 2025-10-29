// server/modules/rondasqr/controllers/assignments.controller.js
import mongoose from "mongoose";
import RqAssignment from "../models/RqAssignment.model.js";
import RqSite from "../models/RqSite.model.js";
import RqRound from "../models/Round.model.js";

/**
 * Crear nueva asignación de ronda
 */
export async function createAssignment(req, res) {
  try {
    const { date, siteId, roundId, guardUserId, startTime, alertTime } = req.body;

    if (!siteId || !roundId || !guardUserId) {
      return res.status(400).json({ ok: false, error: "Faltan campos obligatorios" });
    }

    const doc = await RqAssignment.create({
      date,
      siteId,
      roundId,
      guardUserId,
      startTime,
      alertTime,
      status: "Asignado",
    });

    // Buscar nombres para mensaje
    const site = await RqSite.findById(siteId).lean();
    const round = await RqRound.findById(roundId).lean();

    // Disparar notificación real
    const notifier = req.app.get("notifier");
    await notifier.assignment({
      userId: guardUserId,
      email: null,
      siteName: site?.name || "Sitio",
      roundName: round?.name || "Ronda",
      startTime,
      endTime: alertTime || null,
      assignmentId: doc._id?.toString(),
    });

    res.status(201).json({ ok: true, assignment: doc });
  } catch (e) {
    console.error("[createAssignment]", e);
    res.status(500).json({ ok: false, error: e.message || "Error interno" });
  }
}

/**
 * Listar asignaciones del día
 */
export async function listAssignments(req, res) {
  try {
    const { date } = req.query;
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
