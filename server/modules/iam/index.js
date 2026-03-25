// server/modules/iam/index.js
import express from "express";
import fileUpload from "express-fileupload";

import { makeAuthMw } from "./utils/auth.util.js";
import { makeOptionalAuthMw } from "./utils/optionalAuth.util.js";
import { devOr } from "./utils/rbac.util.js";

import authOtpRoutes from "./routes/auth.otp.routes.js";
import registerVisitorRoutes from "./routes/auth.register.visitor.routes.js";

import meRoutes from "./routes/me.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import permissionsRoutes from "./routes/permissions.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";

import { parseExcelRolesPermissions, seedFromParsed } from "./utils/seed.util.js";
import { logBitacoraEvent } from "../bitacora/services/bitacora.service.js";

const ah =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function clientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    ""
  );
}

function normalizeRoleValue(role) {
  if (!role) return "";

  if (typeof role === "string") return role.trim();

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    ).trim();
  }

  return String(role).trim();
}

function getPrimaryRole(userLike) {
  const roles = Array.isArray(userLike?.roles) ? userLike.roles : [];
  return normalizeRoleValue(roles[0] || "");
}

async function logIamModuleEvent(req, payload = {}) {
  try {
    await logBitacoraEvent({
      modulo: "IAM",
      tipo: "IAM",
      prioridad: payload.prioridad || "Media",
      estado: payload.estado || "Registrado",
      source: payload.source || "iam-module",
      agente:
        req?.user?.email ||
        req?.user?.name ||
        payload.agente ||
        "Sistema IAM",
      actorId:
        req?.user?.sub ||
        req?.user?._id ||
        req?.user?.id ||
        payload.actorId ||
        "",
      actorEmail: req?.user?.email || payload.actorEmail || "",
      actorRol: getPrimaryRole(req?.user) || payload.actorRol || "",
      ip: clientIp(req),
      userAgent: req?.get?.("user-agent") || "",
      ...payload,
    });
  } catch (err) {
    console.error("[IAM][bitacora][index]", err?.message || err);
  }
}

export async function registerIAMModule({
  app,
  basePath = "/api/iam/v1",
  enableLegacyRedirects = false,
  jsonLimit = "5mb",
} = {}) {
  if (!app) throw new Error("[IAM] registerIAMModule requiere { app }");

  const router = express.Router();

  router.use(express.json({ limit: jsonLimit }));

  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  router.use((req, res, next) => {
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const authMw = makeAuthMw();
  const authOptional = makeOptionalAuthMw();

  router.get("/_ping", (_req, res) =>
    res.json({ ok: true, module: "iam", version: "v1", mode: "local" })
  );

  /* ================= AUTH ================= */

  router.use("/auth", authOtpRoutes);
  router.use("/auth", registerVisitorRoutes);

  /* ================= ME ================= */

  router.use("/me", authOptional, meRoutes);

  /* ================= ADMIN ================= */

  router.use("/users", authMw, usersRoutes);
  router.use("/roles", authMw, rolesRoutes);
  router.use("/permissions", authMw, permissionsRoutes);
  router.use("/audit", authMw, auditRoutes);
  router.use("/sessions", authMw, sessionsRoutes);

  /* ================= IMPORT ================= */

  router.post(
    "/import/excel",
    authMw,
    devOr((_req, _res, next) => next()),
    fileUpload({
      limits: { fileSize: 5 * 1024 * 1024 },
      abortOnLimit: true,
    }),
    ah(async (req, res) => {
      const up = req?.files?.file;
      if (!up) {
        await logIamModuleEvent(req, {
          accion: "IMPORT_EXCEL",
          entidad: "IAMSeed",
          titulo: "Importación IAM sin archivo",
          descripcion:
            "Se intentó importar un Excel de roles/permisos sin adjuntar archivo.",
          estado: "Fallido",
          prioridad: "Media",
          source: "iam-import",
        });

        return res.status(400).json({
          ok: false,
          message: "Sube un archivo Excel en el campo 'file'.",
        });
      }

      const file = Array.isArray(up) ? up[0] : up;

      if (!Buffer.isBuffer(file?.data)) {
        await logIamModuleEvent(req, {
          accion: "IMPORT_EXCEL",
          entidad: "IAMSeed",
          titulo: "Importación IAM con archivo inválido",
          descripcion: "No se pudo leer el archivo cargado para importación.",
          estado: "Fallido",
          prioridad: "Media",
          source: "iam-import",
          meta: {
            fileName: file?.name || "",
            mimeType: file?.mimetype || "",
          },
        });

        return res.status(400).json({
          ok: false,
          message: "No se pudo leer el archivo.",
        });
      }

      const parsed = parseExcelRolesPermissions(file.data);
      await seedFromParsed(parsed);

      await logIamModuleEvent(req, {
        accion: "IMPORT_EXCEL",
        entidad: "IAMSeed",
        titulo: "Importación IAM completada",
        descripcion:
          "Se importaron correctamente roles y permisos desde archivo Excel.",
        estado: "Exitoso",
        prioridad: "Media",
        source: "iam-import",
        meta: {
          fileName: file?.name || "",
          mimeType: file?.mimetype || "",
          importedRoles: Object.keys(parsed.roles || {}).length,
          importedPermissions: (parsed.permissions || []).length,
        },
      });

      return res.json({
        ok: true,
        imported: {
          roles: Object.keys(parsed.roles || {}).length,
          permissions: (parsed.permissions || []).length,
        },
      });
    })
  );

  /* ================= ERROR HANDLER ================= */

  router.use(async (err, req, res, _next) => {
    console.error("[IAM]", err?.stack || err);

    await logIamModuleEvent(req, {
      accion: "IAM_ERROR",
      entidad: "IAMModule",
      titulo: "Error interno en módulo IAM",
      descripcion: err?.message || "Internal Server Error",
      estado: "Fallido",
      prioridad: "Alta",
      source: "iam-module",
      meta: {
        method: req?.method || "",
        path: req?.originalUrl || req?.url || "",
      },
    });

    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  });

  app.use(basePath, router);

  if (enableLegacyRedirects) {
    app.use("/api/iam", (req, res) => res.redirect(307, `${basePath}${req.url}`));
    app.use("/iam/v1", (req, res) => res.redirect(307, `${basePath}${req.url}`));
  }

  console.log(`[IAM] módulo montado en ${basePath}`);

  return router;
}