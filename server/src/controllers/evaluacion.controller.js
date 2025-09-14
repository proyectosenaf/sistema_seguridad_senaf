import Evaluacion from "../models/Evaluacion.js";
import Supervision from "../models/Supervision.js"; // tu modelo de supervisión

export async function list(req, res) {
  const { periodo, q = "", page = 1, limit = 1000 } = req.query;
  const filter = {};
  if (periodo) filter.periodo = periodo;
  if (q) filter.empleado = { $regex: q, $options: "i" };

  const [items, total] = await Promise.all([
    Evaluacion.find(filter).sort({ empleado: 1 }).skip((page - 1) * limit).limit(Number(limit)),
    Evaluacion.countDocuments(filter),
  ]);

  res.json({ items, total, page: Number(page), limit: Number(limit) });
}

export async function create(req, res) {
  const payload = req.body;
  payload.creadoPor = {
    sub:   req.auth?.payload?.sub,
    name:  req.auth?.payload?.name,
    email: req.auth?.payload?.email,
  };
  const doc = await Evaluacion.create(payload);
  res.status(201).json(doc);
}

export async function getById(req, res) {
  const it = await Evaluacion.findById(req.params.id);
  if (!it) return res.status(404).json({ message: "No encontrado" });
  res.json(it);
}

export async function update(req, res) {
  const it = await Evaluacion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!it) return res.status(404).json({ message: "No encontrado" });
  res.json(it);
}

export async function remove(req, res) {
  const ok = await Evaluacion.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: "No encontrado" });
  res.status(204).end();
}

// Promedia supervisiones CERRADAS del mes (por guardia) y crea/actualiza evaluaciones
export async function syncFromSupervision(req, res) {
  const { periodo } = req.body; // YYYY-MM
  const start = new Date(`${periodo}-01T00:00:00.000Z`);
  const next = new Date(start); next.setUTCMonth(next.getUTCMonth() + 1);

  const agg = await Supervision.aggregate([
    { $match: { estado: "cerrada", createdAt: { $gte: start, $lt: next } } },
    { $group: { _id: "$guardia", avg: { $avg: "$puntaje" } } },
    { $project: { empleado: "$_id", puntuacion: { $round: ["$avg", 1] } } },
  ]);

  let upserted = 0;
  for (const r of agg) {
    const doc = await Evaluacion.findOneAndUpdate(
      { empleado: r.empleado, periodo },
      { empleado: r.empleado, periodo, puntuacion: r.puntuacion, fuente: "supervision" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (doc) upserted++;
  }

  res.json({ periodo, upserted, guards: agg.length });
}
// (Opcional) GET /api/evaluacion/_stats  → para el panel
export async function stats(_req, res) {    
  const [total, conEvaluacion] = await Promise.all([
    Evaluacion.countDocuments({}),
    Evaluacion.countDocuments({ puntuacion: { $gt: 0 } }),
  ]); 
  res.json({ total, conEvaluacion });
}   