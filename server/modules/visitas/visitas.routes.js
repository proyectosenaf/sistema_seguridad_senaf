import { Router } from "express";
import {
  getVisitas,
  createVisita,
  closeVisita,
} from "./visitas.controller.js";

const router = Router();

/**
 * Seguridad / permisos:
 * En este primer paso lo dejamos abierto igual que hiciste con /api/incidentes.
 * Luego, si quieres, podemos envolver con requireAuth o con un middleware de roles.
 */

// Lista
router.get("/", getVisitas);

// Crear nueva visita
router.post("/", createVisita);

// Cerrar visita (marcar salida)
router.patch("/:id/cerrar", closeVisita);

export default router;
