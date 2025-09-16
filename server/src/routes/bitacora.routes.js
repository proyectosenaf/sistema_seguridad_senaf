// server/src/routes/bitacora.routes.js
import express from "express";
import Bitacora from "../models/bitacoraEntry.model.js";
import { bus } from "../server.js"; // EventEmitter que re-emites por Socket.IO
const router = express.Router();

/** GET /api/bitacora?q=&level=&modulo=&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const { q = "", level, modulo, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (level) filter.level = level;
    if (modulo) filter.modulo = modulo;
    if (q) filter.$text = { $search: q };

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Bitacora.find(filter).sort({ ts: -1 }).skip(skip).limit(Number(limit)).lean(),
      Bitacora.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

/** POST /api/bitacora  (para registrar eventos del sistema) */
router.post("/", async (req, res, next) => {
  try {
    const doc = await Bitacora.create(req.body);
    // emite evento en tiempo real
    bus.emit("bitacora:new", doc);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

export default router;
