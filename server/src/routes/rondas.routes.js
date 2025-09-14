// routes/visitas.routes.js
import { Router } from "express";
import Visita from "../models/Visita.js";

const r = Router();
r.get("/", async (req,res) => {
  const { q, limit = 50 } = req.query;
  const filter = {};
  if (q) filter.$text = { $search: q };      // si creas índice de texto en nombre/persona
  const items = await Visita.find(filter)
    .populate({ path:"visitante", select:"nombreCompleto dni" })
    .populate({ path:"empleado",  populate: { path:"persona", select:"nombreCompleto" } })
    .populate("vehiculo")
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();
  res.json(items);
});
export default r;