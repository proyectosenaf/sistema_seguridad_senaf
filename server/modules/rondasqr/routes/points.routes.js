import { Router } from "express";
import {
  createPoint,
  deletePoint,
  listPoints,
  reorderPoints,
} from "../controllers/points.controller.js";
import { requirePermission } from "../../../src/middleware/permissions.js";

const r = Router();

const RONDASQR_PERMS = {
  POINTS_READ: "rondasqr.points.read",
  POINTS_WRITE: "rondasqr.points.write",
  POINTS_DELETE: "rondasqr.points.delete",
  ROUND_READ: "rondasqr.rounds.read",
  ROUND_WRITE: "rondasqr.rounds.write",
  REPORTS_READ: "rondasqr.reports.read",

  READ_LEGACY: "rondasqr.read",
  WRITE_LEGACY: "rondasqr.write",

  ALL: "*",
};

r.get(
  "/",
  requirePermission(
    RONDASQR_PERMS.POINTS_READ,
    RONDASQR_PERMS.ROUND_READ,
    RONDASQR_PERMS.REPORTS_READ,
    RONDASQR_PERMS.READ_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  listPoints
);

r.post(
  "/",
  requirePermission(
    RONDASQR_PERMS.POINTS_WRITE,
    RONDASQR_PERMS.ROUND_WRITE,
    RONDASQR_PERMS.WRITE_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  createPoint
);

r.delete(
  "/:id",
  requirePermission(
    RONDASQR_PERMS.POINTS_DELETE,
    RONDASQR_PERMS.POINTS_WRITE,
    RONDASQR_PERMS.ROUND_WRITE,
    RONDASQR_PERMS.WRITE_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  deletePoint
);

r.put(
  "/reorder",
  requirePermission(
    RONDASQR_PERMS.POINTS_WRITE,
    RONDASQR_PERMS.ROUND_WRITE,
    RONDASQR_PERMS.WRITE_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  reorderPoints
);

export default r;