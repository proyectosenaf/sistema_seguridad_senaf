import Visita from "../models/Visita.js";

export async function list(req, res) {
  const page  = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 100);
  const q     = String(req.query.q ?? "");
  const estado= req.query.estado;

  const filter = {};
  if (estado) filter.estado = estado;
  if (q) {
    filter.$or = [
      { nombre:    { $regex: q, $options: "i" } },
      { documento: { $regex: q, $options: "i" } },
      { empresa:   { $regex: q, $options: "i" } },
      { motivo:    { $regex: q, $options: "i" } },
      { anfitrion: { $regex: q, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Visita.find(filter).sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Visita.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit });
}

export async function create(req, res) {
  const { nombre, documento, empresa, motivo, anfitrion,
          estado = "en_curso", horaEntrada = Date.now(), horaSalida } = req.body;

  const createdBy = {
    sub:   req.auth?.payload?.sub,
    name:  req.auth?.payload?.name,
    email: req.auth?.payload?.email,
  };

  const doc = await Visita.create({
    nombre, documento, empresa, motivo, anfitrion,
    estado, horaEntrada, horaSalida, createdBy
  });

  res.status(201).json(doc);
}

export async function getById(req, res) {
  const doc = await Visita.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
}

export async function update(req, res) {
  const updates = req.body;
  const doc = await Visita.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true
  });
  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
}

export async function remove(req, res) {
  const ok = await Visita.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: "No encontrado" });
  res.status(204).end();
}
// (Opcional) GET /api/visitas/_stats  → para el panel
export async function stats(_req, res) {
  const [total, enCurso, finalizadas] = await Promise.all([
    Visita.countDocuments({}),
    Visita.countDocuments({ estado: "en_curso" }),
    Visita.countDocuments({ estado: "finalizada" }),
  ]);
  res.json({ total, enCurso, finalizadas });
}

export async function finalizar(req, res) {
  const doc = await Visita.findByIdAndUpdate(
    req.params.id,
    { estado: "finalizada", horaSalida: new Date() },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
}

export async function reabrir(req, res) {
  const doc = await Visita.findByIdAndUpdate(
    req.params.id,
    { estado: "en_curso", horaSalida: null },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
}
// ⬇️ pequeño wrapper para capturar errores async y evitar que el proceso caiga
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); 