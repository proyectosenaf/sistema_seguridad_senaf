import { Router } from "express";
import {
  createPoint,
  deletePoint,
  listPoints,
  reorderPoints,
} from "../controllers/points.controller.js";

const r = Router();

/* Rutas CRUD */
r.get("/", listPoints);             // Listar puntos por ronda
r.post("/", createPoint);           // Crear punto (order auto)
r.delete("/:id", deletePoint);      // Eliminar punto y recompactar
r.put("/reorder", reorderPoints);   // Reordenar (drag & drop)

export default r;
