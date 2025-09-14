import Incidente from '../models/Incidente.js';
import { pick } from '../utils/pick.js';

export const list = async (req, res) => {
  const { q, estado, tipo, page = 1, limit = 10 } = req.query;
  const filter = {};
  if (estado) filter.estado = estado;
  if (tipo) filter.tipo = tipo;
  if (q) filter.$text = { $search: q };

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Incidente.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Incidente.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

export const create = async (req, res) => {
  const payload = pick(req.body, ['titulo','tipo','descripcion','prioridad','estado','adjuntos','ubicacion']);
  const reportadoPor = req.auth?.sub || req.body.reportadoPor;
  const item = await Incidente.create({ ...payload, reportadoPor });
  res.status(201).json(item);
};

export const getById = async (req, res) => {
  const item = await Incidente.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'No encontrado' });
  res.json(item);
};

export const update = async (req, res) => {
  const payload = pick(req.body, ['titulo','tipo','descripcion','prioridad','estado','adjuntos','ubicacion']);
  const item = await Incidente.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!item) return res.status(404).json({ message: 'No encontrado' });
  res.json(item);
};

export const remove = async (req, res) => {
  const ok = await Incidente.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: 'No encontrado' });
  res.status(204).end();
};