// server/modules/rondasqr/routes/alerts.routes.js (o como lo tengas)
import express from "express";
import RqAlert from "../models/RqAlert.model.js";
import RqMark from "../models/RqMark.model.js";

const router = express.Router();

// Crear alerta directa (man_down/panic)
router.post("/", async (req, res, next) => {
  try {
    const { type, gps, officerEmail, officerName, siteId, roundId, steps = 0, meta = {} } = req.body || {};
    if (!["panic","man_down","immobility"].includes(type)) return res.status(400).json({ error: "type inválido" });
    const item = await RqAlert.create({ type, gps, officerEmail, officerName, siteId, roundId, steps, meta });
    res.status(201).json({ item });
  } catch (e) { next(e); }
});

// Listado (para panel supervisor)
router.get("/", async (req, res, next) => {
  try {
    const q = {};
    if (req.query.type) q.type = req.query.type;
    if (req.query.from || req.query.to) {
      q.at = {};
      if (req.query.from) q.at.$gte = new Date(req.query.from + " 00:00");
      if (req.query.to)   q.at.$lte = new Date(req.query.to   + " 23:59:59.999");
    }
    const items = await RqAlert.find(q).sort({ at: -1 }).limit(500).lean();
    res.json({ items });
  } catch (e) { next(e); }
});

export default router;
