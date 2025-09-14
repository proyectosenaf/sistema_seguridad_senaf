import { Router } from "express";
import Visita from "../models/Visita.js";
import { requireAuth } from "../middleware/auth.js";          // el que ya usas
import { ensureUsuario } from "../middleware/ensureUsuario.js";

const r = Router();

// Si quieres obligar login para todo lo de visitas:
r.use(requireAuth, ensureUsuario);

// LISTAR
r.get("/", async (req, res) => {
  const { estado, desde, hasta, limit = 100 } = req.query;
  const f = {};
  if (estado) f.estado = estado;
  if (desde || hasta) f.fecha = {
    ...(desde && { $gte: new Date(desde) }),
    ...(hasta && { $lte: new Date(hasta) }),
  };

  const rows = await Visita.find(f)
    .sort({ fecha: -1 })
    .limit(Number(limit))
    .populate("visitante", "nombreCompleto dni")
    .populate({ path: "empleado", select: "numeroEmpleado", populate: { path: "persona", select: "nombreCompleto" } })
    .populate("institucion", "nombre")
    .populate("usuario", "nombre email")
    .lean();

  res.json(rows);
});

// CREAR
r.post("/", async (req, res) => {
  // Construye base con alias legacy
  const base = Visita.fromRequest(req.body);

  // Completa "quién registró"
  base.usuario = base.usuario || req.usuario?._id || null;
  base.registradoPor = base.registradoPor || (req.usuario ? {
    sub: req.usuario.sub,
    nombre: req.usuario.nombre,
    email: req.usuario.email,
  } : undefined);

  const doc = await Visita.create(base);

  // Devuelve con populate útil
  const populated = await doc
    .populate("visitante", "nombreCompleto dni")
    .populate({ path: "empleado", select: "numeroEmpleado", populate: { path: "persona", select: "nombreCompleto" } })
    .populate("institucion", "nombre")
    .populate("usuario", "nombre email");

  res.status(201).json(populated);
});

// CAMBIAR ESTADO
r.patch("/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const doc = await Visita.findByIdAndUpdate(id, { estado }, { new: true });
  res.json(doc);
});

export default r;
// Si quieres obligar login para todo lo de visitas: