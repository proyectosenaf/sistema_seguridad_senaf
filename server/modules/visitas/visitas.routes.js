import { Router } from "express";
import {
  getVisitas,
  createVisita,
  closeVisita,
  createCita,
  updateCita,
  listCitas,
  checkinCita,
  listVehiculosVisitasEnSitio,
  updateCitaEstado,
  scanQrCita,
} from "./visitas.controller.js";

import { enforceBusinessHours } from "../../src/middleware/businessHours.js";
import { requirePermission } from "../../src/middleware/permissions.js";

const router = Router();

const VISITAS_PERMS = {
  RECORDS_READ: "visitas.records.read",
  RECORDS_WRITE: "visitas.records.write",
  RECORDS_DELETE: "visitas.records.delete",
  RECORDS_CLOSE: "visitas.records.close",
  REPORTS_READ: "visitas.reports.read",
  REPORTS_EXPORT: "visitas.reports.export",
  QR_SCAN: "visitas.qr.scan",
  VEHICULOS_READ: "visitas.vehiculos.read",

  READ_LEGACY: "visitas.read",
  WRITE_LEGACY: "visitas.write",
  DELETE_LEGACY: "visitas.delete",
  CLOSE_LEGACY: "visitas.close",

  CITAS_READ: "visitas.citas.read",
  CITAS_WRITE: "visitas.citas.write",
  CITAS_CHECKIN: "visitas.citas.checkin",
  CITAS_ESTADO: "visitas.citas.estado",

  ALL: "*",
};

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

router.get("/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/visitas/ping" })
);

router.get(
  ["/visitas/v1/visitas", "/visitas", "/"],
  requirePermission(
    VISITAS_PERMS.RECORDS_READ,
    VISITAS_PERMS.REPORTS_READ,
    VISITAS_PERMS.READ_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(getVisitas)
);

router.post(
  ["/visitas/v1/visitas", "/visitas", "/"],
  requirePermission(
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(createVisita)
);

router.patch(
  ["/visitas/:id/cerrar", "/:id/cerrar"],
  requirePermission(
    VISITAS_PERMS.RECORDS_CLOSE,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.CLOSE_LEGACY,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(closeVisita)
);

router.put(
  "/visitas/:id/finalizar",
  requirePermission(
    VISITAS_PERMS.RECORDS_CLOSE,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.CLOSE_LEGACY,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(closeVisita)
);

router.get(
  ["/visitas/vehiculos-en-sitio", "/vehiculos-en-sitio"],
  requirePermission(
    VISITAS_PERMS.VEHICULOS_READ,
    VISITAS_PERMS.RECORDS_READ,
    VISITAS_PERMS.REPORTS_READ,
    VISITAS_PERMS.READ_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(listVehiculosVisitasEnSitio)
);

/* =========================================================
   CITAS
   Compatibilidad:
   - NUEVO: visitas.citas.*
   - LEGACY: visitas.records.* / visitas.*
   ========================================================= */

router.post(
  "/citas",
  requirePermission(
    VISITAS_PERMS.CITAS_WRITE,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  enforceBusinessHours,
  asyncHandler(createCita)
);

router.get(
  "/citas",
  requirePermission(
    VISITAS_PERMS.CITAS_READ,
    VISITAS_PERMS.RECORDS_READ,
    VISITAS_PERMS.REPORTS_READ,
    VISITAS_PERMS.READ_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(listCitas)
);

router.patch(
  "/citas/:id",
  requirePermission(
    VISITAS_PERMS.CITAS_WRITE,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(updateCita)
);

router.patch(
  "/citas/:id/checkin",
  requirePermission(
    VISITAS_PERMS.CITAS_CHECKIN,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.RECORDS_CLOSE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(checkinCita)
);

router.patch(
  "/citas/:id/estado",
  requirePermission(
    VISITAS_PERMS.CITAS_ESTADO,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.RECORDS_CLOSE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(updateCitaEstado)
);

router.post(
  "/citas/scan-qr",
  requirePermission(
    VISITAS_PERMS.QR_SCAN,
    VISITAS_PERMS.CITAS_CHECKIN,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(scanQrCita)
);

router.post(
  "/citas/scan",
  requirePermission(
    VISITAS_PERMS.QR_SCAN,
    VISITAS_PERMS.CITAS_CHECKIN,
    VISITAS_PERMS.RECORDS_WRITE,
    VISITAS_PERMS.WRITE_LEGACY,
    VISITAS_PERMS.ALL
  ),
  asyncHandler(scanQrCita)
);

export default router;