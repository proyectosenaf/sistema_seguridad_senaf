// server/modules/bitacora/routes/bitacora.routes.js
import { Router } from "express";
import {
  deleteBitacoraEvent,
  getBitacoraEventDetail,
  listBitacoraEvents,
  pingBitacora,
  restoreDeletedBitacoraEvent,
} from "../controllers/bitacora.controller.js";

import { requirePermission } from "../../../src/middleware/permissions.js";

const router = Router();

/* ─────────────── Permisos Bitácora ─────────────── */
const BITACORA_PERMS = {
  VIEW: "bitacora.visualizar",
  RECORDS_READ: "bitacora.records.read",
  RECORDS_WRITE: "bitacora.records.write",
  RECORDS_DELETE: "bitacora.records.delete",
  REPORTS_EXPORT: "bitacora.reports.export",

  READ_LEGACY: "bitacora.read",
  WRITE_LEGACY: "bitacora.write",
  DELETE_LEGACY: "bitacora.delete",

  ALL: "*",
};

/* ─────────────── Rutas ─────────────── */

router.get("/ping", pingBitacora);

router.get(
  "/v1/events",
  requirePermission(
    BITACORA_PERMS.VIEW,
    BITACORA_PERMS.RECORDS_READ,
    BITACORA_PERMS.READ_LEGACY,
    BITACORA_PERMS.ALL
  ),
  listBitacoraEvents
);

router.get(
  "/v1/events/:id",
  requirePermission(
    BITACORA_PERMS.VIEW,
    BITACORA_PERMS.RECORDS_READ,
    BITACORA_PERMS.READ_LEGACY,
    BITACORA_PERMS.ALL
  ),
  getBitacoraEventDetail
);

router.delete(
  "/v1/events/:id",
  requirePermission(
    BITACORA_PERMS.RECORDS_DELETE,
    BITACORA_PERMS.DELETE_LEGACY,
    BITACORA_PERMS.ALL
  ),
  deleteBitacoraEvent
);

router.patch(
  "/v1/events/:id/restore",
  requirePermission(
    BITACORA_PERMS.RECORDS_WRITE,
    BITACORA_PERMS.WRITE_LEGACY,
    BITACORA_PERMS.ALL
  ),
  restoreDeletedBitacoraEvent
);

export default router;