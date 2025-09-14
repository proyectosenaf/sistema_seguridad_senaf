// server/src/validators/incidenteRules.js
import { body, param, query } from "express-validator";

// /incidentes?q=&page=&limit=
export const listRules = [
  query("q").optional().isString().trim().isLength({ max: 120 }),
  query("page").optional().toInt().isInt({ min: 1 }),
  query("limit").optional().toInt().isInt({ min: 1, max: 200 }),
];

// POST/PUT /incidentes
export const createRules = [
  body("titulo").trim().notEmpty().isLength({ max: 140 }),
  body("tipo").isIn(["Robo", "Accidente", "Vandalismo", "Incendio", "Otro"]),
  body("descripcion").optional().isString().isLength({ max: 4000 }),
  body("prioridad").optional().isIn(["baja", "media", "alta"]),
  body("estado").optional().isIn(["abierto", "en_progreso", "cerrado"]),
  body("fechaHora").optional().isISO8601().toDate(),
  body("ubicacion").optional().isString().isLength({ max: 240 }),
];

// /incidentes/:id
export const idRule = [param("id").isMongoId()];
// Puedes agregar más reglas si tienes más endpoints (DELETE, etc.)