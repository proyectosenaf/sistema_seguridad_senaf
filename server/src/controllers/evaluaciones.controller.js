// server/src/controllers/evaluaciones.controller.js
import Evaluacion from "../models/Evaluacion.js";

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n || 0))));
const monthNow = () => new Date().toISOString().slice(0, 7);
const estadoFromProm = (p) =>
  p >= 90 ? "Excelente" : p >= 80 ? "Satisfactorio" : "Requiere Mejora";

/**
 * GET /evaluaciones
 * Devuelve métricas por empleado para el período (?periodo=YYYY-MM, ?q=...).
 * Estructura compatible con tu front (normalizeEmployees).
 */
export const getMetricaPorEmpleado = async (req, res) => {
  try {
    const periodo = (req.query.periodo || monthNow()).trim();
    const q = (req.query.q || "").trim();

    const filtro = { periodo };
    if (q) filtro.empleado = { $regex: q, $options: "i" };

    // última evaluación por empleado en ese periodo
    const docs = await Evaluacion.aggregate([
      { $match: filtro },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: "$empleado",
          empleado: { $first: "$empleado" },
          puntualidad: { $first: "$puntualidad" },
          tareas: { $first: "$tareas" },
        },
      },
    ]);

    const result = docs.map((e) => {
      const diasTotales = 30;
      const tareasTotales = 50;

      const diasPuntuales = Math.round(
        (clamp(e.puntualidad) * diasTotales) / 100
      );
      const tardanzas = Math.max(0, diasTotales - diasPuntuales);

      const tareasCompletadas = Math.round(
        (clamp(e.tareas) * tareasTotales) / 100
      );
      const pendientes = Math.max(0, tareasTotales - tareasCompletadas);

      return {
        nombre: e.empleado,
        puntuales: diasPuntuales,
        totalDias: diasTotales,
        tardanzas,
        completadas: tareasCompletadas,
        totalTareas: tareasTotales,
        pendientes,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("GET /evaluaciones error:", err);
    res
      .status(500)
      .json({ message: "Error al obtener métricas de evaluaciones" });
  }
};

/**
 * GET /evaluaciones/historial
 * Devuelve { empleado, periodo, tipo, rendimiento, puntualidad, tareas, estado, fecha }
 */
export const getHistorial = async (req, res) => {
  try {
    const periodo = (req.query.periodo || "").trim();
    const q = (req.query.q || "").trim();

    const filtro = {};
    if (periodo && periodo !== "Todos") filtro.periodo = periodo;
    if (q) filtro.empleado = { $regex: q, $options: "i" };

    const docs = await Evaluacion.find(filtro)
      .sort({ fecha: -1, updatedAt: -1 })
      .lean();

    const items = docs.map((d) => {
      const prom = clamp(
        (Number(d.puntualidad || 0) +
          Number(d.tareas || 0) +
          Number(d.comunicacion || 0) +
          Number(d.iniciativa || 0) +
          Number(d.actitud || 0)) /
          5
      );

      return {
        empleado: d.empleado,
        periodo: d.periodo,
        tipo: d.tipo || "Mensual",
        rendimiento: prom,
        puntualidad: clamp(d.puntualidad),
        tareas: clamp(d.tareas),
        estado: d.estado || estadoFromProm(prom),
        fecha:
          d.fecha ||
          new Date(d.createdAt || new Date()).toISOString().slice(0, 10),
      };
    });

    res.json(items);
  } catch (err) {
    console.error("GET /evaluaciones/historial error:", err);
    res
      .status(500)
      .json({ message: "Error al obtener historial de evaluaciones" });
  }
};

/**
 * POST /evaluaciones
 * Crea o ACTUALIZA (upsert) la evaluación del empleado+periodo.
 */
export const crear = async (req, res) => {
  try {
    const b = req.body || {};

    const promedio = clamp(
      (Number(b.puntualidad || 0) +
        Number(b.tareas || 0) +
        Number(b.comunicacion || 0) +
        Number(b.iniciativa || 0) +
        Number(b.actitud || 0)) /
        5
    );

    const filter = {
      empleado: b.empleado,
      periodo: b.periodo,
    };

    const update = {
      empleado: b.empleado,
      periodo: b.periodo,
      tipo: b.tipo || "Mensual",
      puntualidad: clamp(b.puntualidad),
      tareas: clamp(b.tareas),
      comunicacion: clamp(b.comunicacion),
      iniciativa: clamp(b.iniciativa),
      actitud: clamp(b.actitud),
      promedio,
      estado: b.estado || estadoFromProm(promedio),
      observaciones: b.observaciones || "",
      recomendaciones: b.recomendaciones || "",
      fecha: b.fecha || new Date().toISOString().slice(0, 10),
    };

    // upsert: si ya existe ese empleado+periodo, se actualiza; si no, se crea
    let doc = await Evaluacion.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    // por si aún se cuela algún 11000 en carrera
    if (err?.code === 11000) {
      console.error("POST /evaluaciones dup-key (empleado+periodo):", err);
      return res
        .status(409)
        .json({ message: "Ya existe una evaluación para ese empleado y período" });
    }

    console.error("POST /evaluaciones error:", err);
    res.status(500).json({ message: "Error al crear evaluación" });
  }
};

/**
 * PUT /evaluaciones/:id
 */
export const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};

    const criterios = [
      "puntualidad",
      "tareas",
      "comunicacion",
      "iniciativa",
      "actitud",
    ];
    if (criterios.some((k) => k in b)) {
      const prev = await Evaluacion.findById(id).lean();
      const vals = {
        puntualidad: b.puntualidad ?? prev?.puntualidad ?? 0,
        tareas: b.tareas ?? prev?.tareas ?? 0,
        comunicacion: b.comunicacion ?? prev?.comunicacion ?? 0,
        iniciativa: b.iniciativa ?? prev?.iniciativa ?? 0,
        actitud: b.actitud ?? prev?.actitud ?? 0,
      };
      const promedio = clamp(
        (vals.puntualidad +
          vals.tareas +
          vals.comunicacion +
          vals.iniciativa +
          vals.actitud) /
          5
      );
      b.promedio = promedio;
      if (!b.estado) b.estado = estadoFromProm(promedio);
    }

    const upd = await Evaluacion.findByIdAndUpdate(id, b, { new: true });
    if (!upd)
      return res.status(404).json({ message: "Evaluación no encontrada" });
    res.json({ ok: true, item: upd });
  } catch (err) {
    console.error("PUT /evaluaciones/:id error:", err);
    res.status(500).json({ message: "Error al actualizar evaluación" });
  }
};

/**
 * DELETE /evaluaciones/:id
 */
export const eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    const del = await Evaluacion.findByIdAndDelete(id);
    if (!del)
      return res.status(404).json({ message: "Evaluación no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /evaluaciones/:id error:", err);
    res.status(500).json({ message: "Error al eliminar evaluación" });
  }
};

export default {
  getMetricaPorEmpleado,
  getHistorial,
  crear,
  actualizar,
  eliminar,
};