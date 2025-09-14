// server/src/routes/personas.routes.js
import { Router } from "express";
import Persona from "../models/Persona.js";

const r = Router();

r.post("/", async (req, res) => {
  const payload = Persona.fromRequest(req.body);
  const doc = await Persona.create(payload);
  res.status(201).json(doc);
});

r.get("/", async (_req, res) => {
  const list = await Persona.find().limit(100)
    .populate("pais departamento ciudadMunicipio")
    .lean();
  res.json(list);
});

export default r;
