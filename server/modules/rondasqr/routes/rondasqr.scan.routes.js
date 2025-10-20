import express from "express";
import RqSite from "../models/RqSite.model.js";
import RqRound from "../models/RqRound.model.js";
import RqPoint from "../models/RqPoint.model.js";
import RqPlan from "../models/RqPlan.model.js";

const router = express.Router();

// --- Sites ---
router.get("/sites", async (_req, res, next) => {
  try { res.json({ items: await RqSite.find({ active: true }).sort({ name: 1 }).lean() }); }
  catch (e) { next(e); }
});

// --- Rounds ---
router.get("/rounds", async (req, res, next) => {
  try {
    const q = {};
    if (req.query.siteId) q.siteId = req.query.siteId;
    res.json({ items: await RqRound.find({ ...q, active: true }).sort({ name: 1 }).lean() });
  } catch (e) { next(e); }
});

// --- Points ---
router.get("/points", async (req, res, next) => {
  try {
    const q = {};
    if (req.query.siteId) q.siteId = req.query.siteId;
    if (req.query.roundId) q.roundId = req.query.roundId;
    res.json({ items: await RqPoint.find({ ...q, active: true }).sort({ order: 1, name: 1 }).lean() });
  } catch (e) { next(e); }
});

// --- Plans (uno por site+round) ---
router.get("/plans", async (req, res, next) => {
  try {
    const q = {};
    if (req.query.siteId) q.siteId = req.query.siteId;
    if (req.query.roundId) q.roundId = req.query.roundId;
    const items = await RqPlan.find(q).lean();
    res.json({ items });
  } catch (e) { next(e); }
});

export default router;
