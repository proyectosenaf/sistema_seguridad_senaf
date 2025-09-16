// src/controllers/routes.controller.js
import Route from "../models/Route.js";

export const RoutesController = {
  async list(req, res) {
    const { siteId, q, page = 1, limit = 20 } = req.query;
    const filter = { };
    if (siteId) filter.siteId = siteId;
    if (q) filter.name = { $regex: q, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Route.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Route.countDocuments(filter)
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  },

  async get(req, res) {
    const route = await Route.findById(req.params.id).lean();
    if (!route) return res.status(404).json({ error: "Ruta no encontrada" });
    res.json(route);
  },

  async create(req, res) {
    const route = await Route.create({ ...req.body, createdBy: req.user?.sub });
    res.status(201).json(route);
  },

  async update(req, res) {
    const route = await Route.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user?.sub },
      { new: true, runValidators: true }
    );
    if (!route) return res.status(404).json({ error: "Ruta no encontrada" });
    res.json(route);
  },

  async remove(req, res) {
    const { id } = req.params;
    const route = await Route.findByIdAndDelete(id);
    if (!route) return res.status(404).json({ error: "Ruta no encontrada" });
    res.json({ ok: true });
  },

  // --------- Checkpoints ----------
  async upsertCheckpoint(req, res) {
    const { id } = req.params; // route id
    const cp = req.body;

    const route = await Route.findById(id);
    if (!route) return res.status(404).json({ error: "Ruta no encontrada" });

    const idx = route.checkpoints.findIndex(c => c.code === cp.code);
    if (idx >= 0) route.checkpoints[idx] = cp;
    else route.checkpoints.push(cp);

    route.updatedBy = req.user?.sub;
    await route.save();
    res.json(route);
  },

  async deleteCheckpoint(req, res) {
    const { id } = req.params;
    const { code } = req.query; // ?code=CP-001
    if (!code) return res.status(400).json({ error: "Falta code" });

    const route = await Route.findById(id);
    if (!route) return res.status(404).json({ error: "Ruta no encontrada" });

    route.checkpoints = route.checkpoints.filter(c => c.code !== code);
    route.updatedBy = req.user?.sub;
    await route.save();
    res.json(route);
  },
};
