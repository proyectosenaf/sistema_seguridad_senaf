import { Router } from "express";
import {
  listarEmpleadosVehiculos,
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  actualizarEmpleadoActivo,
  eliminarEmpleado,
  crearVehiculo,
  toggleEnEmpresa,
  listarMovimientos,
  crearMovimientoManual,
  listarMovimientosManual,
  obtenerCatalogoVehiculos,
  obtenerCatalogoEmpleados,
  obtenerCatalogosAcceso,
} from "../controllers/acceso.controller.js";

const router = Router();

/* Healthcheck simple */
router.get("/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/acceso/ping" })
);

/* ───────── Catálogos backend (para reemplazar quemado en frontend) ───────── */

/**
 * GET /api/acceso/catalogos
 * Devuelve catálogos completos del módulo acceso
 */
router.get("/catalogos", obtenerCatalogosAcceso);

/**
 * GET /api/acceso/catalogos/vehiculos
 * Devuelve catálogo de marcas/modelos/años
 */
router.get("/catalogos/vehiculos", obtenerCatalogoVehiculos);

/**
 * GET /api/acceso/catalogos/empleados
 * Devuelve catálogo de sexos, estados, departamentos, cargos
 */
router.get("/catalogos/empleados", obtenerCatalogoEmpleados);

/* ───────── Empleados + vehículos (tabla principal) ───────── */

/**
 * GET /api/acceso/empleados-vehiculos
 * Devuelve empleados con sus vehículos
 */
router.get("/empleados-vehiculos", listarEmpleadosVehiculos);

/**
 * GET /api/acceso/empleados
 * Lista simple de empleados
 */
router.get("/empleados", listarEmpleados);

/**
 * POST /api/acceso/empleados
 * Crear nuevo empleado
 */
router.post("/empleados", crearEmpleado);

/**
 * PATCH /api/acceso/empleados/:id
 * Actualizar empleado completo
 */
router.patch("/empleados/:id", actualizarEmpleado);

/**
 * PATCH /api/acceso/empleados/:id/activo
 * Cambiar solo estado activo/inactivo
 */
router.patch("/empleados/:id/activo", actualizarEmpleadoActivo);

/**
 * DELETE /api/acceso/empleados/:id
 * Eliminar empleado y sus vehículos
 */
router.delete("/empleados/:id", eliminarEmpleado);

/* ───────── Vehículos de empleados ───────── */

/**
 * POST /api/acceso/vehiculos
 * Crear vehículo ligado a un empleado
 */
router.post("/vehiculos", crearVehiculo);

/**
 * PATCH /api/acceso/vehiculos/:idVehiculo/en-empresa
 * Cambiar estado enEmpresa
 * Acepta body opcional:
 * { enEmpresa: true/false, observacion: "", usuarioGuardia: "" }
 */
router.patch("/vehiculos/:idVehiculo/en-empresa", toggleEnEmpresa);

/* ───────── Historial de movimientos de vehículos ───────── */

/**
 * GET /api/acceso/movimientos?vehiculo=ID
 * Lista últimos movimientos de vehículos
 */
router.get("/movimientos", listarMovimientos);

/* ───────── Movimientos manuales (entradas, salidas, permisos) ───────── */

/**
 * POST /api/acceso/movimientos-manual
 * Crear movimiento manual
 */
router.post("/movimientos-manual", crearMovimientoManual);

/**
 * GET /api/acceso/movimientos-manual
 * Listar movimientos manuales
 */
router.get("/movimientos-manual", listarMovimientosManual);

export default router;