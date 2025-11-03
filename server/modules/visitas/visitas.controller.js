// server/modules/visitas/visitas.controller.js
import mongoose from "mongoose";
import Visita from "./visitas.model.js";

/* Utilidades de limpieza */
const clean = (v) => (typeof v === "string" ? v.trim() : v ?? undefined);
const required = (v) => typeof v === "string" && v.trim().length > 0;

// Rango de día local [00:00, 23:59:59.999]
function dayRange(dayStr /* YYYY-MM-DD */) {
  const start = new Date(`${dayStr}T00:00:00`);
  const end = new Date(`${dayStr}T23:59:59.999`);
  return { start, end };
}

// Rango de mes local (YYYY-MM)
function monthRange(ym /* YYYY-MM */) {
  const start = new Date(`${ym}-01T00:00:00`);
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = new Date(`${ym}-${String(lastDay).padStart(2, "0")}T23:59:59.999`);
  return { start, end };
}

/**
 * GET /api/visitas
 * Lista visitas. Por defecto, SOLO ingresos (no incluye agendadas).
 * Usa ?soloIngresos=0 para traer todo. Filtro opcional: ?estado=Dentro|Finalizada
 */
export async function getVisitas(req, res) {
  try {
    const { soloIngresos = "1", estado } = req.query;

    const filter = {};
    if (soloIngresos === "1") filter.tipo = { $ne: "Agendada" };
    if (estado) filter.estado = estado;

    const visitas = await Visita.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items: visitas });
  } catch (err) {
    console.error("[visitas] getVisitas error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Error interno" });
  }
}

/**
 * POST /api/visitas
 * Crea/Registra un visitante que está entrando (INGRESO real, no agenda).
 */
export async function createVisita(req, res) {
  try {
    const payload = {
      nombre: clean(req.body?.nombre),
      documento: clean(req.body?.documento),
      empresa: clean(req.body?.empresa),
      empleado: clean(req.body?.empleado), // texto libre
      motivo: clean(req.body?.motivo),
      telefono: clean(req.body?.telefono),
      correo: clean(req.body?.correo),
    };

    if (
      !required(payload.nombre) ||
      !required(payload.documento) ||
      !required(payload.empleado) ||
      !required(payload.motivo)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos obligatorios (nombre, documento, empleado, motivo).",
      });
    }

    const visita = await Visita.create({
      ...payload,
      tipo: "Ingreso",
      estado: "Dentro",          // ⬅️ Compat con la UI
      fechaEntrada: new Date(),
    });

    return res.status(201).json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] createVisita error:", err);
    if (err?.name === "ValidationError") {
      return res.status(422).json({ ok: false, error: err.message });
    }
    return res.status(400).json({ ok: false, error: err.message || "No se pudo crear la visita" });
  }
}

/**
 * PATCH /api/visitas/:id/cerrar
 * Marca salida de un visitante (estado → Finalizada, fechaSalida → now).
 */
export async function closeVisita(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const visita = await Visita.findByIdAndUpdate(
      id,
      { estado: "Finalizada", fechaSalida: new Date() },
      { new: true }
    );

    if (!visita) {
      return res.status(404).json({ ok: false, error: "Visita no encontrada" });
    }

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] closeVisita error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Error cerrando visita" });
  }
}

/* =====================  CITAS (AGENDADAS)  ===================== */

/**
 * POST /api/citas
 * Crea una cita AGENDADA (no es ingreso).
 */
export async function createCita(req, res) {
  try {
    const nombre = clean(req.body?.nombre);
    const documento = clean(req.body?.documento);
    const empresa = clean(req.body?.empresa);
    const empleado = clean(req.body?.empleado);
    const motivo = clean(req.body?.motivo);
    const telefono = clean(req.body?.telefono);
    const correo = clean(req.body?.correo);
    const fecha = clean(req.body?.fecha); // YYYY-MM-DD
    const hora = clean(req.body?.hora);   // HH:mm

    if (!required(nombre) || !required(documento) || !required(empleado) || !required(motivo) || !required(fecha) || !required(hora)) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos obligatorios (nombre, documento, empleado, motivo, fecha, hora).",
      });
    }

    const citaAt = new Date(`${fecha}T${hora}:00`);
    if (isNaN(citaAt.getTime())) {
      return res.status(400).json({ ok: false, error: "Fecha u hora inválidas" });
    }

    const doc = await Visita.create({
      nombre, documento, empresa, empleado, motivo, telefono, correo,
      tipo: "Agendada",
      estado: "Programada",
      citaAt,
    });

    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    console.error("[citas] createCita error:", err);
    if (err?.name === "ValidationError") {
      return res.status(422).json({ ok: false, error: err.message });
    }
    return res.status(400).json({ ok: false, error: err.message || "No se pudo agendar la cita" });
  }
}

/**
 * GET /api/citas?day=YYYY-MM-DD | ?month=YYYY-MM | ?start=ISO&end=ISO
 */
export async function listCitas(req, res) {
  try {
    const { day, month, start, end } = req.query;

    const filter = { tipo: "Agendada" };

    if (day) {
      const { start: s, end: e } = dayRange(day);
      filter.citaAt = { $gte: s, $lte: e };
    } else if (month) {
      const { start: s, end: e } = monthRange(month);
      filter.citaAt = { $gte: s, $lte: e };
    } else if (start || end) {
      filter.citaAt = {};
      if (start) filter.citaAt.$gte = new Date(start);
      if (end) filter.citaAt.$lte = new Date(end);
    }

    const items = await Visita.find(filter).sort({ citaAt: 1 }).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[citas] listCitas error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Error listando citas" });
  }
}

/**
 * PATCH /api/citas/:id/checkin
 * Convierte una cita PROGRAMADA en un ingreso real (check-in).
 */
export async function checkinCita(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const visita = await Visita.findById(id);
    if (!visita) return res.status(404).json({ ok: false, error: "Cita no encontrada" });

    if (visita.tipo !== "Agendada") {
      return res.status(409).json({ ok: false, error: "La visita no es una cita agendada" });
    }

    visita.tipo = "Ingreso";
    visita.estado = "Dentro";          // ⬅️ Compat con la UI
    visita.fechaEntrada = new Date();
    await visita.save();

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[citas] checkinCita error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Error realizando check-in" });
  }
}
