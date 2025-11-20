
import { Router } from "express";
import {
  getVisitas,
  createVisita,
  closeVisita,
  createCita,
  listCitas,
  checkinCita,
  listVehiculosVisitasEnSitio,
  updateCitaEstado,
} from "./visitas.controller.js";

// Si tienes un middleware para validar horario, mantenlo importado
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
       GET /api/visitas              → ruta "/visitas"
       POST /api/visitas             → ruta "/visitas"
       GET /api/                     → ruta "/"
   - Si montas en: app.use("/api/visitas", router)
       GET /api/visitas              → ruta "/"
       GET /api/visitas/visitas      → ruta "/visitas"

   - EXTRA compatibilidad:
       GET /api/visitas/v1/visitas
       POST /api/visitas/v1/visitas
*/

router.get(
  ["/visitas/v1/visitas", "/visitas", "/"],
  asyncHandler(getVisitas)
);

// Crear ingreso directo
router.post(
  ["/visitas/v1/visitas", "/visitas", "/"],
  asyncHandler(createVisita)
);

// Cerrar visita (marcar salida / finalizada)
router.patch(
  ["/visitas/:id/cerrar", "/:id/cerrar"],
  asyncHandler(closeVisita)
);

router.put("/visitas/:id/finalizar", asyncHandler(closeVisita)); // usado por VisitasControlPage.jsx

/* ─────────────── VEHÍCULOS DE VISITANTES EN SITIO ─────────────── */
router.get(
  ["/visitas/vehiculos-en-sitio", "/vehiculos-en-sitio"],
  asyncHandler(listVehiculosVisitasEnSitio)
);

/* ─────────────── CITAS (Agendadas) ───────────────
   Endpoints esperados por frontend:
   → POST /api/citas
   → GET /api/citas
*/

// Crear cita con validación de horario
router.post("/citas", enforceBusinessHours, asyncHandler(createCita));

// Listar citas por día o mes
router.get("/citas", asyncHandler(listCitas));

// Check-in de cita → visitante llegó
router.patch("/citas/:id/checkin", asyncHandler(checkinCita));

// Actualizar estado de la cita (usado por VisitsPage)
router.patch("/citas/:id/estado", asyncHandler(updateCitaEstado));

export default router;