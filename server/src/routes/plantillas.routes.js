import { Router } from 'express';
import PlantillaRonda from '../models/PlantillaRonda.js';

const router = Router();

// GET /api/plantillas
router.get('/', async (_req, res, next) => {
  try {
    const items = await PlantillaRonda.find({ activo: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, items });
  } catch (e) { next(e); }
});

// POST /api/plantillas
router.post('/', async (req, res, next) => {
  try {
    const { nombre, puntos = [] } = req.body;
    const item = await PlantillaRonda.create({ nombre, puntos });
    res.status(201).json({ ok: true, item });
  } catch (e) { next(e); }
});

export default router;
