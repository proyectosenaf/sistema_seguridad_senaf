import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";

import IncidentGlobal from "../models/incident.model.js";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
} from "../controllers/incident.controller.js";

import { requirePermission } from "../../../src/middleware/permissions.js";

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getCtx(req) {
  return req?.iam || {};
}

const INCIDENT_PERMS = {
  RECORDS_READ: "incidentes.records.read",
  RECORDS_WRITE: "incidentes.records.write",
  RECORDS_DELETE: "incidentes.records.delete",
  RECORDS_CLOSE: "incidentes.records.close",
  REPORTS_READ: "incidentes.reports.read",
  REPORTS_EXPORT: "incidentes.reports.export",
  EVIDENCES_WRITE: "incidentes.evidences.write",

  READ_LEGACY: "incidentes.read",
  REPORTS_LEGACY: "incidentes.reports",
  CREATE_LEGACY: "incidentes.create",
  EDIT_LEGACY: "incidentes.edit",
  DELETE_LEGACY: "incidentes.delete",

  READ_ANY: "incidentes.read.any",
  REPORTS_ANY: "incidentes.reports.any",
  CREATE_ANY: "incidentes.create.any",
  EDIT_ANY: "incidentes.edit.any",
  DELETE_ANY: "incidentes.delete.any",

  ALL: "*",
};

function getUserId(req) {
  return String(
    req?.user?._id ||
      req?.user?.id ||
      req?.user?.sub ||
      req?.auth?._id ||
      req?.auth?.id ||
      req?.auth?.sub ||
      getCtx(req)?.user?._id ||
      getCtx(req)?.user?.id ||
      getCtx(req)?.user?.sub ||
      getCtx(req)?._id ||
      getCtx(req)?.id ||
      getCtx(req)?.userId ||
      getCtx(req)?.sub ||
      ""
  ).trim();
}

function getUserEmail(req) {
  return String(
    req?.user?.email ||
      req?.auth?.email ||
      getCtx(req)?.email ||
      getCtx(req)?.user?.email ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getUserPermissions(req) {
  const ctx = getCtx(req);

  const directUser = Array.isArray(req?.user?.permissions) ? req.user.permissions : [];
  const directAuth = Array.isArray(req?.auth?.permissions) ? req.auth.permissions : [];
  const directCtx = Array.isArray(ctx?.permissions) ? ctx.permissions : [];

  const rolePermsFromUser = Array.isArray(req?.user?.roles)
    ? req.user.roles.flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        return Array.isArray(r.permissions) ? r.permissions : [];
      })
    : [];

  const rolePermsFromAuth = Array.isArray(req?.auth?.roles)
    ? req.auth.roles.flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        return Array.isArray(r.permissions) ? r.permissions : [];
      })
    : [];

  return uniq(
    [
      ...directUser,
      ...directAuth,
      ...directCtx,
      ...rolePermsFromUser,
      ...rolePermsFromAuth,
    ].map((p) => String(p || "").trim())
  );
}

function hasAnyPermission(req, ...wanted) {
  const perms = getUserPermissions(req).map(norm);
  if (perms.includes(INCIDENT_PERMS.ALL)) return true;

  const normalizedWanted = wanted.map(norm).filter(Boolean);
  return normalizedWanted.some((w) => perms.includes(w));
}

function getUserRoles(req) {
  const ctx = getCtx(req);

  const userRoles = Array.isArray(req?.user?.roles)
    ? req.user.roles
    : req?.user?.roles
    ? [req.user.roles]
    : [];

  const authRoles = Array.isArray(req?.auth?.roles)
    ? req.auth.roles
    : req?.auth?.roles
    ? [req.auth.roles]
    : [];

  const ctxRoles = Array.isArray(ctx?.roles) ? ctx.roles : [];
  const nsRoles = Array.isArray(req?.user?.["https://senaf.local/roles"])
    ? req.user["https://senaf.local/roles"]
    : [];

  return uniq(
    [...userRoles, ...authRoles, ...ctxRoles, ...nsRoles]
      .map((r) => {
        if (typeof r === "string") return norm(r);
        if (r && typeof r === "object") {
          return norm(r.code || r.key || r.slug || r.name || r.nombre);
        }
        return "";
      })
      .filter(Boolean)
  );
}

function hasAnyRole(req, ...wanted) {
  const roles = getUserRoles(req);
  const normalizedWanted = wanted.map(norm).filter(Boolean);
  return normalizedWanted.some((r) => roles.includes(r));
}

function canReadIncidents(req) {
  return hasAnyPermission(
    req,
    INCIDENT_PERMS.RECORDS_READ,
    INCIDENT_PERMS.REPORTS_READ,
    INCIDENT_PERMS.READ_LEGACY,
    INCIDENT_PERMS.REPORTS_LEGACY,
    INCIDENT_PERMS.READ_ANY,
    INCIDENT_PERMS.REPORTS_ANY,
    INCIDENT_PERMS.ALL
  );
}

function canWriteIncidents(req) {
  return hasAnyPermission(
    req,
    INCIDENT_PERMS.RECORDS_WRITE,
    INCIDENT_PERMS.CREATE_LEGACY,
    INCIDENT_PERMS.EDIT_LEGACY,
    INCIDENT_PERMS.CREATE_ANY,
    INCIDENT_PERMS.EDIT_ANY,
    INCIDENT_PERMS.ALL
  );
}

function canDeleteIncidents(req) {
  return hasAnyPermission(
    req,
    INCIDENT_PERMS.RECORDS_DELETE,
    INCIDENT_PERMS.DELETE_LEGACY,
    INCIDENT_PERMS.DELETE_ANY,
    INCIDENT_PERMS.ALL
  );
}

function canReadAnyIncidents(req) {
  return hasAnyPermission(
    req,
    INCIDENT_PERMS.READ_ANY,
    INCIDENT_PERMS.REPORTS_ANY,
    INCIDENT_PERMS.ALL
  );
}

function canWriteAnyIncidents(req) {
  return hasAnyPermission(
    req,
    INCIDENT_PERMS.CREATE_ANY,
    INCIDENT_PERMS.EDIT_ANY,
    INCIDENT_PERMS.ALL
  );
}

function canDeleteAnyIncidents(req) {
  return hasAnyPermission(
    req,
    INCIDENT_PERMS.DELETE_ANY,
    INCIDENT_PERMS.ALL
  );
}

function isAdminLike(req) {
  const ctx = getCtx(req);

  return (
    !!ctx?.isSuperAdmin ||
    hasAnyRole(req, "admin", "superadmin", "supervisor", "jefe", "coordinador") ||
    hasAnyPermission(
      req,
      INCIDENT_PERMS.READ_ANY,
      INCIDENT_PERMS.REPORTS_ANY,
      INCIDENT_PERMS.CREATE_ANY,
      INCIDENT_PERMS.EDIT_ANY,
      INCIDENT_PERMS.DELETE_ANY,
      INCIDENT_PERMS.ALL
    )
  );
}

function isOwnIncident(req, incident) {
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  const ownerCandidates = [
    incident?.createdByUserId,
    incident?.reportedByGuardId,
    incident?.guardId,
    incident?.reportedByUserId,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  const emailCandidates = [incident?.reportedByGuardEmail, incident?.guardEmail]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);

  if (userId && ownerCandidates.includes(userId)) return true;
  if (userEmail && emailCandidates.includes(userEmail)) return true;

  return false;
}

async function requireCreateScope(req, res, next) {
  try {
    if (isAdminLike(req) || canWriteAnyIncidents(req)) {
      return next();
    }

    const isGuard =
      hasAnyRole(req, "guardia", "guard", "rondasqr.guard") ||
      hasAnyPermission(
        req,
        INCIDENT_PERMS.RECORDS_WRITE,
        INCIDENT_PERMS.CREATE_LEGACY,
        INCIDENT_PERMS.REPORTS_READ,
        INCIDENT_PERMS.REPORTS_LEGACY
      );

    if (!isGuard) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado para crear incidentes.",
      });
    }

    const userId = getUserId(req);
    const userEmail = getUserEmail(req);

    const requestedGuardId = String(
      req.body?.reportedByGuardId ||
        req.body?.guardId ||
        req.body?.reportedByUserId ||
        ""
    ).trim();

    const requestedGuardEmail = String(
      req.body?.reportedByGuardEmail ||
        req.body?.guardEmail ||
        req.body?.guardMail ||
        ""
    )
      .trim()
      .toLowerCase();

    if (requestedGuardId && userId && requestedGuardId !== userId) {
      return res.status(403).json({
        ok: false,
        message: "Un guardia solo puede reportar incidentes a su propio nombre.",
      });
    }

    if (requestedGuardEmail && userEmail && requestedGuardEmail !== userEmail) {
      return res.status(403).json({
        ok: false,
        message: "Un guardia solo puede reportar incidentes a su propio nombre.",
      });
    }

    req.body.createdByUserId = userId || req.body.createdByUserId || "";
    req.body.reportedByUserId = userId || req.body.reportedByUserId || "";
    req.body.reportedByGuardId =
      requestedGuardId || userId || req.body.reportedByGuardId || "";
    req.body.guardId = req.body.reportedByGuardId || req.body.guardId || "";
    req.body.reportedByGuardEmail =
      requestedGuardEmail || userEmail || req.body.reportedByGuardEmail || "";
    req.body.guardEmail =
      req.body.reportedByGuardEmail || req.body.guardEmail || "";

    return next();
  } catch (error) {
    console.error("[incidentes.routes] requireCreateScope error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error validando permisos de creación.",
    });
  }
}

async function requireOwnOrAnyEdit(req, res, next) {
  try {
    if (isAdminLike(req) || canWriteAnyIncidents(req)) {
      return next();
    }

    if (!canWriteIncidents(req)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado para editar incidentes.",
      });
    }

    const incident = await IncidentGlobal.findById(req.params.id).lean();
    if (!incident) {
      return res.status(404).json({
        ok: false,
        message: "Incidente no encontrado.",
      });
    }

    if (!isOwnIncident(req, incident)) {
      return res.status(403).json({
        ok: false,
        message: "Solo puedes editar tus propios incidentes.",
      });
    }

    req.incidentDoc = incident;
    return next();
  } catch (error) {
    console.error("[incidentes.routes] requireOwnOrAnyEdit error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error validando permisos de edición.",
    });
  }
}

async function requireOwnOrAnyDelete(req, res, next) {
  try {
    if (isAdminLike(req) || canDeleteAnyIncidents(req)) {
      return next();
    }

    if (!canDeleteIncidents(req)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado para eliminar incidentes.",
      });
    }

    const incident = await IncidentGlobal.findById(req.params.id).lean();
    if (!incident) {
      return res.status(404).json({
        ok: false,
        message: "Incidente no encontrado.",
      });
    }

    if (!isOwnIncident(req, incident)) {
      return res.status(403).json({
        ok: false,
        message: "Solo puedes eliminar tus propios incidentes.",
      });
    }

    req.incidentDoc = incident;
    return next();
  } catch (error) {
    console.error("[incidentes.routes] requireOwnOrAnyDelete error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error validando permisos de eliminación.",
    });
  }
}

function attachReadScope(req, _res, next) {
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  req.incidentScope = {
    canReadAny: isAdminLike(req) || canReadAnyIncidents(req),
    userId,
    userEmail,
  };

  next();
}

router.get(
  "/",
  requirePermission(
    INCIDENT_PERMS.RECORDS_READ,
    INCIDENT_PERMS.REPORTS_READ,
    INCIDENT_PERMS.READ_LEGACY,
    INCIDENT_PERMS.REPORTS_LEGACY,
    INCIDENT_PERMS.READ_ANY,
    INCIDENT_PERMS.REPORTS_ANY,
    INCIDENT_PERMS.ALL
  ),
  attachReadScope,
  getAllIncidents
);

router.post(
  "/",
  requirePermission(
    INCIDENT_PERMS.RECORDS_WRITE,
    INCIDENT_PERMS.CREATE_LEGACY,
    INCIDENT_PERMS.CREATE_ANY,
    INCIDENT_PERMS.EVIDENCES_WRITE,
    INCIDENT_PERMS.ALL
  ),
  requireCreateScope,
  upload.array("photos", 10),
  createIncident
);

router.put(
  "/:id",
  requirePermission(
    INCIDENT_PERMS.RECORDS_WRITE,
    INCIDENT_PERMS.RECORDS_CLOSE,
    INCIDENT_PERMS.EDIT_LEGACY,
    INCIDENT_PERMS.EDIT_ANY,
    INCIDENT_PERMS.ALL
  ),
  requireOwnOrAnyEdit,
  updateIncident
);

router.delete(
  "/:id",
  requirePermission(
    INCIDENT_PERMS.RECORDS_DELETE,
    INCIDENT_PERMS.DELETE_LEGACY,
    INCIDENT_PERMS.DELETE_ANY,
    INCIDENT_PERMS.ALL
  ),
  requireOwnOrAnyDelete,
  deleteIncident
);

export default router;