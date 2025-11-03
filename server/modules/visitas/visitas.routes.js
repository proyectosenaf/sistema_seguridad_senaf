// server/modules/visitas/visitas.routes.js
import { Router } from "express";
import {
  getVisitas,
  createVisita,
  closeVisita,
  createCita,
  listCitas,
  checkinCita,
} from "./visitas.controller.js";

const router = Router();

/**
 * Wrapper para manejar funciones async sin try/catch redundante.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Seguridad / permisos:
 * De momento queda abierto (igual que /api/incidentes).
 * Luego puedes proteger con requireAuth o middleware de roles.
 */

// Healthcheck del módulo
router.get("/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/visitas/ping" })
);

/* ─────────────── VISITAS (Ingresos reales) ─────────────── */

// Lista de visitantes activos / históricos
// Ejemplo: GET /api/visitas?soloIngresos=1
router.get("/visitas", asyncHandler(getVisitas));

// Registrar un nuevo ingreso (visitante real)
router.post("/visitas", asyncHandler(createVisita));

// Cerrar visita (marcar salida)
router.patch("/visitas/:id/cerrar", asyncHandler(closeVisita));

/* ─────────────── CITAS (Agendadas) ─────────────── */

// Crear una cita (programar visita futura)
router.post("/citas", asyncHandler(createCita));

// Listar citas programadas
// Ejemplo: GET /api/citas?day=2025-11-01 o ?month=2025-11
router.get("/citas", asyncHandler(listCitas));

// Registrar check-in (convertir cita → ingreso real)
router.patch("/citas/:id/checkin", asyncHandler(checkinCita));

export default router;
