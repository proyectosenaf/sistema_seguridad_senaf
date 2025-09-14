import { Router } from "express";
import Pais from "../models/Pais.js";
import Departamento from "../models/Departamento.js";
import Ciudad from "../models/Ciudad.js";

const r = Router();

/* --- Países --- */
r.get("/paises", async (req, res) => {
  const { q } = req.query;
  const filter = q ? { nombrePais: { $regex: q, $options: "i" } } : {};
  const rows = await Pais.find(filter).sort("nombrePais").lean();
  res.json(rows);
});
r.post("/paises", async (req, res) => {
  const doc = await Pais.create(Pais.fromRequest(req.body));
  res.status(201).json(doc);
});

/* --- Departamentos --- */
r.get("/departamentos", async (req, res) => {
  const { pais, q } = req.query;
  const filter = {};
  if (pais) filter.pais = pais;
  if (q) filter.nombreDepartamento = { $regex: q, $options: "i" };
  const rows = await Departamento.find(filter)
    .populate("pais", "nombrePais")
    .sort("nombreDepartamento")
    .lean();
  res.json(rows);
});
r.post("/departamentos", async (req, res) => {
  const doc = await Departamento.create(Departamento.fromRequest(req.body));
  res.status(201).json(doc);
});

/* --- Ciudades --- */
r.get("/ciudades", async (req, res) => {
  const { departamento, q } = req.query;
  const filter = {};
  if (departamento) filter.departamento = departamento;
  if (q) filter.nombreCiudadMunicipio = { $regex: q, $options: "i" };
  const rows = await Ciudad.find(filter)
    .populate({ path: "departamento", select: "nombreDepartamento", populate: { path: "pais", select: "nombrePais" } })
    .sort("nombreCiudadMunicipio")
    .lean();
  res.json(rows);
});
r.post("/ciudades", async (req, res) => {
  const doc = await Ciudad.create(Ciudad.fromRequest(req.body));
  res.status(201).json(doc);
});

export default r;
