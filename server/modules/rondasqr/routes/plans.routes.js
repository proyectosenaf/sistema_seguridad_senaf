// server/modules/rondasqr/routes/plans.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import RqPlan from "../models/RqPlan.model.js";

const r = Router();
const isId = (v) => typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

// POST /api/rondasqr/v1/plans  -> crea/actualiza plan activo para sitio+ronda
r.post("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, points = [], active = true } = req.body || {};
    if (!isId(siteId) || !isId(roundId)) {
      return res.status(400).json({ ok: false, error: "invalid_site_or_round" });
    }

    const normPoints = []
      .concat(points || [])
      .map((p, i) => ({
        pointId: isId(p?.pointId) ? new mongoose.Types.ObjectId(p.pointId) : null,
        order: Number.isFinite(p?.order) ? Number(p.order) : i,
        windowStartMin: p?.windowStartMin ?? null,
        windowEndMin: p?.windowEndMin ?? null,
        toleranceMin: p?.toleranceMin ?? null,
      }))
      .filter((p) => p.pointId);

    const update = {
      siteId: new mongoose.Types.ObjectId(siteId),
      roundId: new mongoose.Types.ObjectId(roundId),
      active: !!active,
      points: normPoints,
      updatedAt: new Date(),
    };

    const item = await RqPlan.findOneAndUpdate(
      { siteId: update.siteId, roundId: update.roundId },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    res.status(201).json({ ok: true, item });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, error: "duplicate_plan" });
    }
    next(e);
  }
});

// GET /api/rondasqr/v1/plans?siteId=&roundId=
r.get("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId } = req.query || {};
    const filter = {};
    if (isId(siteId)) filter.siteId = siteId;
    if (isId(roundId)) filter.roundId = roundId;
    const item = await RqPlan.findOne(filter).lean();
    res.json({ ok: true, item });
  } catch (e) { next(e); }
});

// DELETE /api/rondasqr/v1/plans?siteId=&roundId=
r.delete("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId } = req.query || {};
    if (!isId(siteId) || !isId(roundId)) {
      return res.status(400).json({ ok: false, error: "invalid_site_or_round" });
    }
    const rdel = await RqPlan.deleteOne({ siteId, roundId });
    res.json({ ok: true, deleted: rdel.deletedCount });
  } catch (e) { next(e); }
});

export default r;
