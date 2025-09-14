import Acceso from '../models/Acceso.js';
import { pick } from '../utils/pick.js';


export const list = async (req, res) => {
const { tipo, persona, page = 1, limit = 10 } = req.query;
const filter = {};
if (tipo) filter.tipo = tipo;
if (persona) filter.persona = persona;
const skip = (Number(page) - 1) * Number(limit);
const [items, total] = await Promise.all([
Acceso.find(filter).sort({ hora: -1 }).skip(skip).limit(Number(limit)),
Acceso.countDocuments(filter),
]);
res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};


export const getById = async (req, res) => {
const item = await Acceso.findById(req.params.id);
if (!item) return res.status(404).json({ message: 'No encontrado' });
res.json(item);
};


export const create = async (req, res) => {
const payload = pick(req.body, ['tipo','persona','credencialId','area','hora','autorizado','por']);
payload.creadoPor = req.auth?.payload?.sub || 'desconocido';
const item = await Acceso.create(payload);
res.status(201).json(item);
};


export const update = async (req, res) => {
const payload = pick(req.body, ['tipo','persona','credencialId','area','hora','autorizado','por']);
const item = await Acceso.findByIdAndUpdate(req.params.id, payload, { new: true });
if (!item) return res.status(404).json({ message: 'No encontrado' });
res.json(item);
};


export const remove = async (req, res) => {
const ok = await Acceso.findByIdAndDelete(req.params.id);
if (!ok) return res.status(404).json({ message: 'No encontrado' });
res.status(204).end();
};