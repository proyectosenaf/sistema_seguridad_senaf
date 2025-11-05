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

/* ─────────────── VISITAS (Ingresos reales) ───────────────
   Compatibilidad de montaje:
   - Si montas en app.use("/api/visitas", router):
       GET /api/visitas           → usa la ruta "/"
       GET /api/visitas/visitas   → también responde (por compat)
   - Si montas en app.use("/api", router):
       GET /api/visitas           → usa la ruta "/visitas"
*/

// Lista de visitantes activos / históricos
// Ejemplo: GET /api/visitas  o  GET /api/visitas/visitas
router.get(["/visitas", "/"], asyncHandler(getVisitas));

// Registrar un nuevo ingreso (visitante real)
router.post(["/visitas", "/"], asyncHandler(createVisita));

// Cerrar visita (marcar salida)
router.patch(["/visitas/:id/cerrar", "/:id/cerrar"], asyncHandler(closeVisita));

/* ─────────────── CITAS (Agendadas) ───────────────
   Nota: Estas rutas se esperan en /api/citas (AgendaPage.jsx).
   → Monta este router en "/api" para que queden como /api/citas.
*/

// Crear una cita (programar visita futura)
router.post("/citas", asyncHandler(createCita));

// Listar citas programadas
// Ejemplo: GET /api/citas?day=2025-11-01 o ?month=2025-11
router.get("/citas", asyncHandler(listCitas));

// Registrar check-in (convertir cita → ingreso real)
router.patch("/citas/:id/checkin", asyncHandler(checkinCita));

export default router;
