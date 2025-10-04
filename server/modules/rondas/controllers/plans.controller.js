// server/modules/rondas/controllers/plans.controller.js
import Plan from "../models/RondasPlan.model.js";
import { asyncWrap } from "../utils/async.util.js";

/* Helpers */
const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// HH:mm -> true/false
function isHHmm(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}
// HH:mm -> minutos desde 00:00 (0..1439)
function toMinutes(s) {
  const [hh, mm] = String(s).split(":").map(Number);
  return (hh * 60) + (mm || 0);
}
// Valida y normaliza el payload de plan
function normalizePlanPayload(body = {}, { isEdit = false } = {}) {
  const out = {};

  // name
  if (!isEdit || body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) throw new Error("El nombre del plan es requerido.");
    out.name = name;
  }

  // zoneId (solo se exige en create)
  if (!isEdit) {
    if (!body.zoneId) throw new Error("zoneId es requerido.");
    out.zoneId = body.zoneId;
  } else if (body.zoneId !== undefined) {
    out.zoneId = body.zoneId;
  }

  // daysOfWeek
  if (!isEdit || body.daysOfWeek !== undefined) {
    const list = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [];
    if (!list.length) throw new Error("Selecciona al menos un día de la semana.");
    const clean = [...new Set(list.map(Number))].filter(n => n >= 0 && n <= 6).sort((a,b)=>a-b);
    if (!clean.length) throw new Error("daysOfWeek no válido.");
    out.daysOfWeek = clean;
  }

  // scheduleType
  if (!isEdit || body.scheduleType !== undefined) {
    const st = body.scheduleType === "night" ? "night" : "day"; // default "day"
    out.scheduleType = st;
  }

  // startTime / endTime (HH:mm)
  const haveStart = (!isEdit || body.startTime !== undefined);
  const haveEnd   = (!isEdit || body.endTime   !== undefined);

  if (haveStart) {
    if (!isHHmm(body.startTime)) throw new Error("startTime inválido (formato HH:mm).");
    out.startTime = body.startTime;
  }
  if (haveEnd) {
    if (!isHHmm(body.endTime)) throw new Error("endTime inválido (formato HH:mm).");
    out.endTime = body.endTime;
  }

  // Si nos pasaron ambos, validamos rango. Si solo uno (en edit), validaremos más abajo con los valores actuales del doc.
  if (haveStart && haveEnd) {
    const s = toMinutes(body.startTime);
    const e = toMinutes(body.endTime);
    // Permitimos cruces de medianoche (ej: 22:00 → 06:00), así que no exigimos e > s.
    if (s === e) throw new Error("La hora de inicio y final no pueden ser iguales.");
  }

  // active
  if (!isEdit || body.active !== undefined) {
    out.active = body.active === false ? false : true;
  }

  // Opcional: descripción u otros campos
  if (body.description !== undefined) out.description = String(body.description || "").slice(0, 600);

  return out;
}

/* CRUD */

export const listPlans = asyncWrap(async (req, res) => {
  const q = {};
  if (req.query.zoneId) q.zoneId = req.query.zoneId;
  if (req.query.active === "true") q.active = true;
  if (req.query.active === "false") q.active = false;

  const items = await Plan.find(q).sort({ createdAt: -1 }).lean();
  res.json(items);
});

export const createPlan = asyncWrap(async (req, res) => {
  // Validar + normalizar
  const payload = normalizePlanPayload(req.body, { isEdit: false });

  // Auditoría básica
  payload.createdBy = req.user?.sub || req.headers["x-user-id"] || "admin-ui";

  const item = await Plan.create(payload);
  res.status(201).json(item);
});

export const updatePlan = asyncWrap(async (req, res) => {
  const id = req.params.id;

  // Tomamos el doc actual para validar rango si solo vino start o end
  const current = await Plan.findById(id);
  if (!current) return res.status(404).json({ message: "Plan no encontrado" });

  const patch = normalizePlanPayload(req.body, { isEdit: true });

  // Validación extra si solo vino uno de los dos tiempos
  const st = isHHmm(patch.startTime) ? patch.startTime : current.startTime;
  const et = isHHmm(patch.endTime)   ? patch.endTime   : current.endTime;

  const sm = toMinutes(st);
  const em = toMinutes(et);
  if (sm === em) throw new Error("La hora de inicio y final no pueden ser iguales.");

  // (Opcional) puedes impedir que una ronda 'day' cruce medianoche, etc.
  // if ((patch.scheduleType || current.scheduleType) === "day" && em < sm) {
  //   throw new Error("En jornada diurna, la hora final debe ser posterior a la inicial.");
  // }

  patch.updatedAt = new Date();
  const item = await Plan.findByIdAndUpdate(id, patch, { new: true });
  res.json(item);
});

export const deletePlan = asyncWrap(async (req, res) => {
  const ok = await Plan.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: "Plan no encontrado" });
  res.json({ ok: true });
});
