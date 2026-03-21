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

import { requirePermission } from "../../../src/middleware/permissions.js";

const router = Router();

const ACCESO_PERMS = {
  RECORDS_READ: "accesos.records.read",
  RECORDS_WRITE: "accesos.records.write",
  RECORDS_DELETE: "accesos.records.delete",
  RECORDS_CLOSE: "accesos.records.close",
  REPORTS_READ: "accesos.reports.read",
  REPORTS_EXPORT: "accesos.reports.export",
  CATALOGS_READ: "accesos.catalogs.read",

  READ_LEGACY: "accesos.read",
  WRITE_LEGACY: "accesos.write",
  DELETE_LEGACY: "accesos.delete",

  ALL: "*",
};

router.get("/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/acceso/ping" })
);

router.get(
  "/catalogos",
  requirePermission(
    ACCESO_PERMS.CATALOGS_READ,
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  obtenerCatalogosAcceso
);

router.get(
  "/catalogos/vehiculos",
  requirePermission(
    ACCESO_PERMS.CATALOGS_READ,
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  obtenerCatalogoVehiculos
);

router.get(
  "/catalogos/empleados",
  requirePermission(
    ACCESO_PERMS.CATALOGS_READ,
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  obtenerCatalogoEmpleados
);

router.get(
  "/empleados-vehiculos",
  requirePermission(
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.REPORTS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  listarEmpleadosVehiculos
);

router.get(
  "/empleados",
  requirePermission(
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  listarEmpleados
);

router.post(
  "/empleados",
  requirePermission(
    ACCESO_PERMS.RECORDS_WRITE,
    ACCESO_PERMS.WRITE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  crearEmpleado
);

router.patch(
  "/empleados/:id",
  requirePermission(
    ACCESO_PERMS.RECORDS_WRITE,
    ACCESO_PERMS.WRITE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  actualizarEmpleado
);

router.patch(
  "/empleados/:id/activo",
  requirePermission(
    ACCESO_PERMS.RECORDS_WRITE,
    ACCESO_PERMS.RECORDS_CLOSE,
    ACCESO_PERMS.WRITE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  actualizarEmpleadoActivo
);

router.delete(
  "/empleados/:id",
  requirePermission(
    ACCESO_PERMS.RECORDS_DELETE,
    ACCESO_PERMS.DELETE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  eliminarEmpleado
);

router.post(
  "/vehiculos",
  requirePermission(
    ACCESO_PERMS.RECORDS_WRITE,
    ACCESO_PERMS.WRITE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  crearVehiculo
);

router.patch(
  "/vehiculos/:idVehiculo/en-empresa",
  requirePermission(
    ACCESO_PERMS.RECORDS_WRITE,
    ACCESO_PERMS.RECORDS_CLOSE,
    ACCESO_PERMS.WRITE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  toggleEnEmpresa
);

router.get(
  "/movimientos",
  requirePermission(
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.REPORTS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  listarMovimientos
);

router.post(
  "/movimientos-manual",
  requirePermission(
    ACCESO_PERMS.RECORDS_WRITE,
    ACCESO_PERMS.WRITE_LEGACY,
    ACCESO_PERMS.ALL
  ),
  crearMovimientoManual
);

router.get(
  "/movimientos-manual",
  requirePermission(
    ACCESO_PERMS.RECORDS_READ,
    ACCESO_PERMS.REPORTS_READ,
    ACCESO_PERMS.READ_LEGACY,
    ACCESO_PERMS.ALL
  ),
  listarMovimientosManual
);

export default router;