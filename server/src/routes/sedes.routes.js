import { Router } from 'express';
import Sede from '../models/Sede.js';

const router = Router();

// GET /api/sedes
router.get('/', async (_req, res, next) => {
  try {
    const items = await Sede.find({ activo: true }).sort({ nombre: 1 }).lean();
    res.json({ ok: true, items });
  } catch (e) { next(e); }
});

// (Opcional) POST /api/sedes
router.post('/', async (req, res, next) => {
  try {
    const { nombre, codigo, direccion } = req.body;
    const item = await Sede.create({ nombre, codigo, direccion });
    res.status(201).json({ ok: true, item });
  } catch (e) { next(e); }
});

export default router;
