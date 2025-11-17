// server/src/modules/visitas/visitas.routes.js
import { Router } from "express";
import {
  getVisitas,
  createVisita,
  closeVisita,
  createCita,
  listCitas,
  checkinCita,
  listVehiculosVisitasEnSitio,
} from "./visitas.controller.js";

// Middleware de horario de atención (8:00–12:00 y 13:00–17:00)
//import { enforceBusinessHours } from "../../middlewares/businessHours.js";
import { enforceBusinessHours } from "../../src/middleware/businessHours.js";

const router = Router();

/**
 * Wrapper para manejar funciones async sin try/catch en cada handler
 */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Healthcheck del módulo
 */
router.get("/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/visitas/ping" })
);

/* ─────────────── VISITAS (Ingresos reales) ───────────────
   Compatibilidad de montaje:

   - Si montas en: app.use("/api", router)
       GET /api/visitas        → ruta "/visitas"
       POST /api/visitas       → ruta "/visitas"
       GET /api/               → ruta "/"
   - Si montas en: app.use("/api/visitas", router)
       GET /api/visitas        → ruta "/"
       GET /api/visitas/visitas→ ruta "/visitas"
*/

// Lista de visitas (histórico + dentro)
router.get(["/visitas", "/"], asyncHandler(getVisitas));

// Crear ingreso directo
router.post(["/visitas", "/"], asyncHandler(createVisita));

// Cerrar visita (marcar salida / finalizada)
// Compatibilidad con dos paths distintos:
router.patch(["/visitas/:id/cerrar", "/:id/cerrar"], asyncHandler(closeVisita));
router.put("/visitas/:id/finalizar", asyncHandler(closeVisita)); // usado por VisitasControlPage.jsx

/* ─────────────── VEHÍCULOS DE VISITANTES EN SITIO ───────────────
   Para el módulo de Control de Acceso (tabla de visitantes en estacionamiento)
   - Usar desde el front: GET /api/visitas/vehiculos-en-sitio
*/
router.get(
  ["/visitas/vehiculos-en-sitio", "/vehiculos-en-sitio"],
  asyncHandler(listVehiculosVisitasEnSitio)
);

/* ─────────────── CITAS (Agendadas) ───────────────
   Se esperan como /api/citas desde el frontend de Agenda
*/

// Crear cita con validación de horario
router.post("/citas", enforceBusinessHours, asyncHandler(createCita));

// Listar citas (?day=YYYY-MM-DD o ?month=YYYY-MM)
router.get("/citas", asyncHandler(listCitas));

// Check-in de cita → pasa a "Dentro"
router.patch("/citas/:id/checkin", asyncHandler(checkinCita));

export default router;
