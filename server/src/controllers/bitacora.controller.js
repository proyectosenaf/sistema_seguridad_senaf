import Bitacora from '../models/Bitacora.js';
import { pick } from '../utils/pick.js';


export const list = async (req, res) => {
const { q, tipo, page = 1, limit = 10 } = req.query;
const filter = {};
if (tipo) filter.tipo = tipo;
if (q) filter.$text = { $search: q };
const skip = (Number(page) - 1) * Number(limit);
const [items, total] = await Promise.all([
Bitacora.find(filter).sort({ fecha: -1 }).skip(skip).limit(Number(limit)),
Bitacora.countDocuments(filter),
]);
res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};


export const getById = async (req, res) => {
const item = await Bitacora.findById(req.params.id);
if (!item) return res.status(404).json({ message: 'No encontrado' });
res.json(item);
};


export const create = async (req, res) => {
const payload = pick(req.body, ['fecha','autor','tipo','contenido','adjuntos']);
payload.creadoPor = req.auth?.payload?.sub || 'desconocido';
const item = await Bitacora.create(payload);
res.status(201).json(item);
};


export const update = async (req, res) => {
const payload = pick(req.body, ['fecha','autor','tipo','contenido','adjuntos']);
const item = await Bitacora.findByIdAndUpdate(req.params.id, payload, { new: true });
if (!item) return res.status(404).json({ message: 'No encontrado' });
res.json(item);
};


export const remove = async (req, res) => {
const ok = await Bitacora.findByIdAndDelete(req.params.id);
if (!ok) return res.status(404).json({ message: 'No encontrado' });
res.status(204).end();
};