// server/modules/rondasqr/routes/rondasqr.scan.routes.js
import express from "express";
import RqMark from "../models/RqMark.model.js";
import RqPoint from "../models/RqPoint.model.js";
import RqRound from "../models/RqRound.model.js";
import RqSite from "../models/RqSite.model.js";

const router = express.Router();

/**
 * Handler que registra una marca de ronda.
 * Body esperado:
 * {
 *   qr: "PT-01",           // QR No del punto
 *   hardwareId: "DEV-01",
 *   message?: "texto",
 *   steps?: 123,
 *   gps?: { lat, lon }
 * }
 */
async function handleScan(req, res, next) {
  try {
    const b = req.body || {};
    if (!b.qr) {
      return res.status(400).json({ ok: false, error: "QR requerido" });
    }

    // Busca el punto por qrNo
    const point = await RqPoint.findOne({ qrNo: b.qr }).lean();
    if (!point) {
      return res.status(404).json({ ok: false, error: "Punto no encontrado para ese QR" });
    }

    // (Opcional) trae nombres de site/round
    const [round, site] = await Promise.all([
      point.roundId ? RqRound.findById(point.roundId).lean() : null,
      point.siteId  ? RqSite.findById(point.siteId).lean()  : null,
    ]);

    const doc = await RqMark.create({
      hardwareId: b.hardwareId || "",
      qrNo: point.qrNo,
      siteId: point.siteId || null,
      roundId: point.roundId || null,
      pointId: point._id,
      pointName: point.name || "",
      // nombres para reportes
      siteName: site?.name || "",
      roundName: round?.name || "",
      message: b.message || "",
      steps: Number(b.steps || 0),
      at: new Date(),
      // guardia (si tenés auth, completa desde req.auth; si no, deja vacío)
      guardName:  req?.auth?.payload?.name  || "",
      guardId:    req?.auth?.payload?.sub   || "",
      officerName: req?.auth?.payload?.name  || "",   // compat con reportes
      officerEmail: req?.auth?.payload?.email || "",
      // gps
      gps: b.gps || {},
      loc: (b?.gps?.lat != null && b?.gps?.lon != null)
        ? { type: "Point", coordinates: [Number(b.gps.lon), Number(b.gps.lat)] }
        : undefined,
      pointQr: point.qrNo, // compat con reportes CSV/KML
    });

    // emitir a sockets si corresponde
    req.io?.emit?.("rondasqr:mark", { item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
}

/* Exponer ambos endpoints como alias */
router.post("/scan", handleScan);            // /api/rondasqr/v1/scan
router.post("/checkin/scan", handleScan);    // /api/rondasqr/v1/checkin/scan  <-- tu fetch

export default router;
