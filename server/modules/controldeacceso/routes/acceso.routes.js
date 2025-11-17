import { Router } from "express";
import {
  listarEmpleadosVehiculos,
  crearEmpleado,
  actualizarEmpleado,
  crearVehiculo,
  toggleEnEmpresa,
  listarMovimientos,
} from "../controllers/acceso.controller.js";

const router = Router();

/* Healthcheck simple */
router.get("/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/acceso/ping" })
);

/* ───────── Empleados + vehículos (tabla principal) ───────── */

/**
 * GET /api/acceso/empleados-vehiculos
 * Devuelve empleados con sus vehículos (lo que consume Accesos.jsx)
 */
router.get("/empleados-vehiculos", listarEmpleadosVehiculos);

/**
 * (Opcional) GET /api/acceso/empleados
 * Para compatibilidad: usa el mismo listado.
 */
router.get("/empleados", listarEmpleadosVehiculos);

/**
 * POST /api/acceso/empleados
 * Crear nuevo empleado (NuevoEmpleadoModal)
 */
router.post("/empleados", crearEmpleado);

/**
 * PATCH /api/acceso/empleados/:id
 * Actualizar datos del empleado (EditarEmpleadoModal)
 */
router.patch("/empleados/:id", actualizarEmpleado);

/* ───────── Vehículos de empleados ───────── */

/**
 * POST /api/acceso/vehiculos
 * Crear vehículo ligado a un empleado (NuevoVehiculoModal)
 */
router.post("/vehiculos", crearVehiculo);

/**
 * PATCH /api/acceso/vehiculos/:idVehiculo/en-empresa
 * Toggle enEmpresa (switch en la tabla)
 */
router.patch("/vehiculos/:idVehiculo/en-empresa", toggleEnEmpresa);

/* ───────── Historial de movimientos ───────── */

/**
 * GET /api/acceso/movimientos?vehiculo=ID
 * Lista últimos movimientos de vehículos
 */
router.get("/movimientos", listarMovimientos);

export default router;
