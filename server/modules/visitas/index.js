// server/src/modules/visitas/index.js
import { Router } from "express";
import Visita from "./visita.model.js";

const router = Router();

/** GET /api/visitas
 *  Devuelve las visitas (las más recientes primero)
 */
router.get("/", async (req, res, next) => {
  try {
    const items = await Visita.find({})
      .sort({ fechaEntrada: -1, createdAt: -1 })
      .lean();
    return res.json({ ok: true, items });
  } catch (e) {
    return next(e);
  }
});

/** POST /api/visitas
 *  Crea una visita con estado "Dentro" y fechaEntrada = ahora
 *  Espera body: { nombre, documento, empresa?, empleado?, motivo, telefono?, correo? }
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      nombre,
      documento,
      empresa = null,
      empleado = null, // texto libre
      motivo,
      telefono = null,
      correo = null,
    } = req.body || {};

    if (!nombre || !documento || !motivo) {
      return res
        .status(400)
        .json({ ok: false, error: "Faltan campos requeridos (nombre, documento, motivo)" });
    }

    const doc = await Visita.create({
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
      estado: "Dentro",
      fechaEntrada: new Date(),
      fechaSalida: null,
    });

    return res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    return next(e);
  }
});

/** PATCH /api/visitas/:id/cerrar
 *  Marca la salida (estado=Finalizada, fechaSalida=ahora)
 */
router.patch("/:id/cerrar", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, error: "Falta id" });

    const now = new Date();
    const updated = await Visita.findByIdAndUpdate(
      id,
      { $set: { estado: "Finalizada", fechaSalida: now } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Visita no encontrada" });
    }
    return res.json({ ok: true, item: updated });
  } catch (e) {
    return next(e);
  }
});

export default router;
