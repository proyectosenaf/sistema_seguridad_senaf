// server/modules/rondasqr/controllers/points.controller.js
import RqPoint from "../models/RqPoint.model.js";

export async function createPoint(req, res, next) {
  try {
    const { siteId, roundId, name, qr } = req.body;
    if (!siteId || !roundId || !name || !qr) {
      return res.status(400).json({ message: "siteId, roundId, name y qr son requeridos" });
    }
    const doc = await RqPoint.create({ siteId, roundId, name, qr });
    res.status(201).json(doc);
  } catch (err) {
    // si choca índice único, lo reportamos bonito
    if (err.code === 11000) {
      return res.status(409).json({ message: "Duplicado (order o qr) en la misma ronda" });
    }
    next(err);
  }
}

export async function deletePoint(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await RqPoint.findByIdAndDelete(id).lean();
    if (!doc) return res.status(404).json({ message: "Punto no encontrado" });

    // Recompacta: 5→4, 6→5, ...
    await RqPoint.compactAfterDelete(doc.roundId, doc.order);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// (opcional) reordenar por drag&drop desde la UI
export async function reorderPoints(req, res, next) {
  try {
    // body: { roundId, pointIds: [id1, id2, id3, ...] } en el orden deseado
    const { roundId, pointIds } = req.body || {};
    if (!roundId || !Array.isArray(pointIds)) {
      return res.status(400).json({ message: "roundId y pointIds[] son requeridos" });
    }
    const ops = pointIds.map((id, idx) => ({
      updateOne: { filter: { _id: id, roundId }, update: { $set: { order: idx } } }
    }));
    await RqPoint.bulkWrite(ops);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
