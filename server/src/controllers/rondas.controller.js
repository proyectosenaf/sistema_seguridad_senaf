import Ronda from '../models/Ronda.js';
import { pick } from '../utils/pick.js';


export const list = async (req, res) => {
const { estado, guardia, page = 1, limit = 10 } = req.query;
const filter = {};
if (estado) filter.estado = estado;
if (guardia) filter.guardia = guardia;
const skip = (Number(page) - 1) * Number(limit);
const [items, total] = await Promise.all([
Ronda.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
Ronda.countDocuments(filter),
]);
res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};


export const getById = async (req, res) => {
const item = await Ronda.findById(req.params.id);
if (!item) return res.status(404).json({ message: 'No encontrado' });
res.json(item);
};


export const create = async (req, res) => {
const payload = pick(req.body, ['guardia','inicio','fin','ruta','incidencias','estado']);
payload.creadoPor = req.auth?.payload?.sub || 'desconocido';
const item = await Ronda.create(payload);
res.status(201).json(item);
};


export const update = async (req, res) => {
const payload = pick(req.body, ['guardia','inicio','fin','ruta','incidencias','estado']);
const item = await Ronda.findByIdAndUpdate(req.params.id, payload, { new: true });
if (!item) return res.status(404).json({ message: 'No encontrado' });
res.json(item);
};


export const remove = async (req, res) => {
const ok = await Ronda.findByIdAndDelete(req.params.id);
if (!ok) return res.status(404).json({ message: 'No encontrado' });
res.status(204).end();
};