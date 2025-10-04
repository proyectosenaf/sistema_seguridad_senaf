import { Router } from "express";
import Zone from "../models/Zone.model.js";
import Checkpoint from "../models/Checkpoint.model.js";

const r = Router();

// GET /api/rondas/v1/zones
r.get("/", async (_req, res) => {
  const zones = await Zone.find({}).sort({ code: 1 }).lean();
  res.json(zones);
});

// GET /api/rondas/v1/zones/:id/checkpoints
r.get("/:id/checkpoints", async (req, res) => {
  const cps = await Checkpoint.find({ zoneId: req.params.id, active: true })
    .sort({ order: 1 })
    .lean();
  res.json(cps);
});

export default r;
