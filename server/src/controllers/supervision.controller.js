import Supervision from "../models/Supervision.js";
import SupervisionPlan from "../models/SupervisionPlan.js";
import Evaluacion from "../models/Evaluacion.js";
import { yyyymm } from "../utils/periodo.js";

/* ---------- LISTAR / CRUD DE REGISTROS ---------- */
export async function list(req, res) {
  const { q = "", estado, page = 1, limit = 100 } = req.query;
  const filter = {};
  if (estado) filter.estado = estado;
  if (q) filter.$or = [
    { guardia: { $regex: q, $options: "i" } },
    { area:    { $regex: q, $options: "i" } },
    { observaciones: { $regex: q, $options: "i" } },
  ];

  const [items, total] = await Promise.all([
    Supervision.find(filter).sort({ createdAt: -1 })
      .skip((page-1)*limit).limit(Number(limit)).lean(),
    Supervision.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: Number(limit) });
}

export async function create(req, res) {
  const me = { sub: req.auth?.payload?.sub, name: req.auth?.payload?.name, email: req.auth?.payload?.email };
  const doc = await Supervision.create({
    ...req.body,
    supervisor: me,            // quien lo crea también puede ser supervisor
    createdBy: me,
    periodo: yyyymm(req.body.fecha || Date.now()),
    programada: Boolean(req.body.planId),
  });
  res.status(201).json(doc);
}

export async function update(req, res) {
  const doc = await Supervision.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
}

export async function remove(req, res) {
  const ok = await Supervision.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: "No encontrado" });
  res.status(204).end();
}

/* ---------- CIERRE / REAPERTURA Y EVALUACIÓN ---------- */
export async function cerrar(req, res) {
  const me = { sub: req.auth?.payload?.sub, name: req.auth?.payload?.name, email: req.auth?.payload?.email };

  const doc = await Supervision.findByIdAndUpdate(
    req.params.id,
    { estado: "cerrada", supervisor: me, periodo: yyyymm(Date.now()) },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "No encontrado" });

  // upsert en Evaluacion mensual del guardia
  const ev = await Evaluacion.findOneAndUpdate(
    { empleado: doc.guardia, periodo: doc.periodo },
    {
      $setOnInsert: { empleado: doc.guardia, periodo: doc.periodo, sumPuntaje: 0, total: 0, promedio: 0 },
      $push: { detalles: { supervisionId: doc._id, fecha: doc.fecha, puntaje: doc.puntaje, area: doc.area, supervisor: me } },
      $inc: { sumPuntaje: doc.puntaje, total: 1 }
    },
    { new: true, upsert: true }
  );
  // recalcula promedio
  ev.promedio = Math.round((ev.sumPuntaje / Math.max(ev.total,1)) * 100) / 100;
  await ev.save();

  res.json(doc);
}

export async function reabrir(req, res) {
  const doc = await Supervision.findByIdAndUpdate(
    req.params.id, { estado: "abierta" }, { new: true }
  );
  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
}

/* ---------- PLANES ---------- */
export async function listPlans(_req, res) {
  const plans = await SupervisionPlan.find({}).sort({ createdAt: -1 }).lean();
  res.json(plans);
}

export async function createPlan(req, res) {
  const me = { sub: req.auth?.payload?.sub, name: req.auth?.payload?.name, email: req.auth?.payload?.email };
  const plan = await SupervisionPlan.create({ ...req.body, createdBy: me });
  res.status(201).json(plan);
}

export async function updatePlan(req, res) {
  const plan = await SupervisionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!plan) return res.status(404).json({ message: "No encontrado" });
  res.json(plan);
}

export async function removePlan(req, res) {
  const ok = await SupervisionPlan.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: "No encontrado" });
  res.status(204).end();
}

/* ---------- GENERACIÓN DE TAREAS PROGRAMADAS ---------- */
function matches(plan, d) {
  const dow = d.getDay();       // 0..6
  const dom = d.getDate();      // 1..31
  if (plan.frecuencia === "diaria") return true;
  if (plan.frecuencia === "semanal") return (plan.diasSemana || []).includes(dow);
  if (plan.frecuencia === "mensual") return plan.diaMes === dom;
  return false;
}

/** Genera supervisiones ABiertas para una fecha (ejecución en cron o manual) */
export async function generateForDate(date = new Date()) {
  const day = new Date(date);
  day.setHours(0,0,0,0);

  const plans = await SupervisionPlan.find({
    activo: true,
    inicio: { $lte: day },
    $or: [ { fin: null }, { fin: { $gte: day } } ]
  });

  const toCreate = [];
  for (const p of plans) {
    if (!matches(p, day)) continue;

    // Evita duplicar si ya existe para ese plan/fecha
    const exists = await Supervision.findOne({
      planId: p._id,
      programada: true,
      fecha: { $gte: day, $lt: new Date(day.getTime()+24*60*60*1000) }
    }).lean();

    if (!exists) {
      // combina la hora del plan con la fecha del día
      const [hh, mm] = (p.hora || "09:00").split(":").map(Number);
      const fecha = new Date(day); fecha.setHours(hh||0, mm||0, 0, 0);

      toCreate.push({
        planId: p._id,
        programada: true,
        guardia: p.guardia,
        area: p.area,
        fecha,
        estado: "abierta",
        puntaje: 80,
        observaciones: "",
        periodo: yyyymm(fecha),
      });
    }
  }
  if (toCreate.length) await Supervision.insertMany(toCreate);
  return toCreate.length;
}

/** endpoint manual para generar en una fecha concreta */
export async function runPlans(req, res) {
  const d = req.query.date ? new Date(req.query.date) : new Date();
  const n = await generateForDate(d);
  res.json({ generated: n, date: d.toISOString().slice(0,10) });
}