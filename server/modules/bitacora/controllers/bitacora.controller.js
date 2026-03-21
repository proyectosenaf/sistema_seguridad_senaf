// server/modules/bitacora/controllers/bitacora.controller.js
import {
  archiveBitacoraEvent,
  getBitacoraEventById,
  getBitacoraEvents,
  restoreBitacoraEvent,
} from "../services/bitacora.service.js";

export async function pingBitacora(_req, res) {
  return res.json({ ok: true, where: "/api/bitacora/ping" });
}

export async function listBitacoraEvents(req, res) {
  try {
    const filters = {
      desde: req.query.desde || "",
      hasta: req.query.hasta || "",
      agente: req.query.agente || "",
      tipo: req.query.tipo || "",
      modulo: req.query.modulo || "",
      turno: req.query.turno || "",
    };

    const items = await getBitacoraEvents(filters);

    return res.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error("[bitacora] listBitacoraEvents:", err);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron listar los eventos de bitácora.",
      detail: err.message,
    });
  }
}

export async function getBitacoraEventDetail(req, res) {
  try {
    const rawId = decodeURIComponent(String(req.params.id || "")).trim();

    if (!rawId) {
      return res.status(400).json({
        ok: false,
        message: "ID inválido para consultar evento.",
      });
    }

    const item = await getBitacoraEventById(rawId);

    return res.json({
      ok: true,
      item,
    });
  } catch (err) {
    console.error("[bitacora] getBitacoraEventDetail:", err);
    return res.status(err.status || 500).json({
      ok: false,
      message: err.message || "No se pudo obtener el detalle del evento.",
    });
  }
}

export async function deleteBitacoraEvent(req, res) {
  try {
    const rawId = decodeURIComponent(String(req.params.id || "")).trim();

    if (!rawId) {
      return res.status(400).json({
        ok: false,
        message: "ID inválido para archivar evento.",
      });
    }

    const actor =
      req.user?.email ||
      req.user?.name ||
      req.authUser?.email ||
      "sistema";

    const result = await archiveBitacoraEvent(rawId, actor);

    return res.json({
      ok: true,
      message: "Evento archivado correctamente.",
      item: result,
    });
  } catch (err) {
    console.error("[bitacora] deleteBitacoraEvent:", err);
    return res.status(err.status || 500).json({
      ok: false,
      message: err.message || "No se pudo archivar el evento.",
    });
  }
}

export async function restoreDeletedBitacoraEvent(req, res) {
  try {
    const rawId = decodeURIComponent(String(req.params.id || "")).trim();

    if (!rawId) {
      return res.status(400).json({
        ok: false,
        message: "ID inválido para restaurar evento.",
      });
    }

    const result = await restoreBitacoraEvent(rawId);

    return res.json({
      ok: true,
      message: "Evento restaurado correctamente.",
      item: result,
    });
  } catch (err) {
    console.error("[bitacora] restoreDeletedBitacoraEvent:", err);
    return res.status(err.status || 500).json({
      ok: false,
      message: err.message || "No se pudo restaurar el evento.",
    });
  }
}