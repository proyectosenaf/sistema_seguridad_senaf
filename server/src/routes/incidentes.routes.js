// routes/incidentes.routes.js
import { Router } from "express";
import Incidente from "../models/Incidente.js";

const r = Router();
r.get("/", async (_req,res)=>{
  const items = await Incidente.find()
    .populate({ path:"guardia", populate:{ path:"empleado", populate:{ path:"persona", select:"nombreCompleto" } } })
    .sort({ createdAt:-1 })
    .lean();
  res.json(items);
});
r.post("/", async (req,res)=> {
  const doc = await Incidente.create(req.body);
  res.status(201).json(doc);
});
export default r;
