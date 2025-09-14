import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import Incidente from "../models/Incidente.js";
import Visita from "../models/Visita.js";
import Supervision from "../models/Supervision.js";

const r = Router();
r.use(requireAuth);

// GET /api/search?q=texto
r.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json({
      q,
      results: { incidentes: [], visitas: [], supervision: [] },
    });
  }

  const rx = { $regex: q, $options: "i" };

  const [incidentes, visitas, supervision] = await Promise.all([
    Incidente.find({
      $or: [{ titulo: rx }, { descripcion: rx }, { tipo: rx }, { prioridad: rx }, { estado: rx }],
    })
      .sort({ fechaHora: -1 })
      .limit(5)
      .select("_id titulo tipo prioridad estado fechaHora")
      .lean(),

    Visita.find({
      $or: [{ nombre: rx }, { documento: rx }, { motivo: rx }, { empresa: rx }, { anfitrion: rx }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id nombre documento motivo estado createdAt")
      .lean(),

    Supervision.find({
      $or: [{ guardia: rx }, { area: rx }, { observaciones: rx }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id guardia area puntaje estado createdAt")
      .lean(),
  ]);

  res.json({ q, results: { incidentes, visitas, supervision } });
});

export default r;
// Ruta para búsqueda global en incidentes, visitas y supervisión