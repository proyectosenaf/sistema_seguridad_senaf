import { Router } from "express";
import mongoose from "mongoose";
import RqPlan from "../models/RqPlan.model.js";

const r = Router();
const isId = (v) => typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

function normalizePlanDoc(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    siteId: doc.siteId,
    roundId: doc.roundId,
    shift: doc.shift || "dia",
    active: !!doc.active,
    points: Array.isArray(doc.points) ? doc.points : [],
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

// ─────────────────────────────────────────────
// POST /api/rondasqr/v1/plans
// crea/actualiza plan para sitio+ronda+shift
// ─────────────────────────────────────────────
r.post("/plans", async (req, res, next) => {
  try {
    const {
      siteId,
      roundId,
      points = [],
      active = true,
      shift = "dia",
      name,
    } = req.body || {};
    if (!isId(siteId) || !isId(roundId)) {
      return res
        .status(400)
        .json({ ok: false, error: "invalid_site_or_round" });
    }

    const normPoints = []
      .concat(points || [])
      .map((p, i) => ({
        pointId: isId(p?.pointId)
          ? new mongoose.Types.ObjectId(p.pointId)
          : null,
        order: Number.isFinite(p?.order) ? Number(p.order) : i,
        windowStartMin:
          typeof p?.windowStartMin === "number"
            ? p.windowStartMin
            : undefined,
        windowEndMin:
          typeof p?.windowEndMin === "number" ? p.windowEndMin : undefined,
        toleranceMin:
          typeof p?.toleranceMin === "number" ? p.toleranceMin : undefined,
      }))
      .filter((p) => p.pointId);

    const update = {
      siteId: new mongoose.Types.ObjectId(siteId),
      roundId: new mongoose.Types.ObjectId(roundId),
      shift: String(shift || "dia").toLowerCase(),
      active: !!active,
      points: normPoints,
      updatedAt: new Date(),
    };

    if (typeof name === "string" && name.trim()) {
      update.name = name.trim();
    }

    const item = await RqPlan.findOneAndUpdate(
      {
        siteId: update.siteId,
        roundId: update.roundId,
        shift: update.shift,
      },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    res.status(201).json({ ok: true, item: normalizePlanDoc(item) });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, error: "duplicate_plan" });
    }
    next(e);
  }
});

// ─────────────────────────────────────────────
// GET /api/rondasqr/v1/plans?siteId=&roundId=&shift=
// ─────────────────────────────────────────────
r.get("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, shift } = req.query || {};
    const filter = {};
    if (isId(siteId))
      filter.siteId = new mongoose.Types.ObjectId(siteId);
    if (isId(roundId))
      filter.roundId = new mongoose.Types.ObjectId(roundId);
    if (shift) filter.shift = String(shift).toLowerCase();

    const docs = await RqPlan.find(filter).lean();
    const items = docs.map(normalizePlanDoc);

    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// DELETE /api/rondasqr/v1/plans?siteId=&roundId=&shift=
// ─────────────────────────────────────────────
r.delete("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, shift } = req.query || {};
    if (!isId(siteId) || !isId(roundId)) {
      return res
        .status(400)
        .json({ ok: false, error: "invalid_site_or_round" });
    }
    const q = {
      siteId: new mongoose.Types.ObjectId(siteId),
      roundId: new mongoose.Types.ObjectId(roundId),
    };
    if (shift) q.shift = String(shift).toLowerCase();

    const rdel = await RqPlan.deleteOne(q);
    res.json({ ok: true, deleted: rdel.deletedCount });
  } catch (e) {
    next(e);
  }
});

/* ===== ALIAS /admin/plans ===== */

// GET /api/rondasqr/v1/admin/plans
r.get("/admin/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, shift } = req.query || {};
    const filter = {};
    if (isId(siteId))
      filter.siteId = new mongoose.Types.ObjectId(siteId);
    if (isId(roundId))
      filter.roundId = new mongoose.Types.ObjectId(roundId);
    if (shift) filter.shift = String(shift).toLowerCase();

    const docs = await RqPlan.find(filter).lean();
    const items = docs.map(normalizePlanDoc);

    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    next(e);
  }
});

// POST /api/rondasqr/v1/admin/plans
r.post("/admin/plans", async (req, res, next) => {
  req.url = "/plans";
  r.handle(req, res, next);
});

// DELETE /api/rondasqr/v1/admin/plans
r.delete("/admin/plans", async (req, res, next) => {
  req.url = "/plans";
  r.handle(req, res, next);
});

export default r;
