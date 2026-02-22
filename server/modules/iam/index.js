// server/modules/iam/index.js
import express from "express";
import fileUpload from "express-fileupload";

import { makeAuthMw } from "./utils/auth.util.js";
import { devOr } from "./utils/rbac.util.js";

import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import permissionsRoutes from "./routes/permissions.routes.js";
import auditRoutes from "./routes/audit.routes.js";

import { parseExcelRolesPermissions, seedFromParsed } from "./utils/seed.util.js";

const ah =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Registra el módulo IAM en la app principal de Express.
 *
 * - basePath por defecto: "/api/iam/v1"
 * - Alias legacy: "/api/iam"
 * - Alias DO path-trim: "/iam/v1"
 *
 * Cambios clave:
 * - NO usar router.options("*", ...) (rompe Express 5 / path-to-regexp). En su lugar:
 *   - respondemos OPTIONS con router.use y método.
 * - Orden claro de middlewares/rutas.
 * - Import Excel: authMw + devOr + fileUpload (solo ruta).
 * - jsonLimit parametrizable.
 */
export async function registerIAMModule({
  app,
  basePath = "/api/iam/v1",
  enableDoAlias = true,
  jsonLimit = "5mb",
} = {}) {
  if (!app) throw new Error("[IAM] registerIAMModule requiere { app }");

  const router = express.Router();

  // Body JSON
  router.use(express.json({ limit: jsonLimit }));

  // Preflight defensivo (si tu app global no maneja CORS)
  // Evita el patrón "*" que en Express 5 da error.
  router.use((req, res, next) => {
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const authMw = makeAuthMw();

  // Ping para probar montaje
  router.get("/_ping", (_req, res) =>
    res.json({ ok: true, module: "iam", version: "v1" })
  );

  // AUTH público (si tu login requiere token, protégelo en auth.routes)
  router.use("/auth", authRoutes);

  /**
   * ✅ CORRECCIÓN CLAVE (sin romper tu estructura):
   * /me NO debe ir protegido con authMw porque tu /me está diseñado para:
   * - visitor:true si NO hay token
   * - datos si SÍ hay token
   *
   * Si lo proteges con authMw, en producción te devuelve 401/403 y "no puedes pasar del login"
   * cuando todavía no tienes token.
   */
  router.use("/me", meRoutes);

  // Rutas protegidas (admin/gestión)
  router.use("/users", authMw, usersRoutes);
  router.use("/roles", authMw, rolesRoutes);
  router.use("/permissions", authMw, permissionsRoutes);
  router.use("/audit", authMw, auditRoutes);

  // Import Excel (solo dev) + recomendado: dev autenticado
  router.post(
    "/import/excel",
    authMw,
    devOr((_req, _res, next) => next()),
    fileUpload({
      limits: { fileSize: 5 * 1024 * 1024 },
      abortOnLimit: true,
      useTempFiles: false,
    }),
    ah(async (req, res) => {
      const up = req?.files?.file;

      if (!up) {
        return res.status(400).json({
          ok: false,
          message: "Sube un archivo Excel en el campo 'file'.",
        });
      }

      // express-fileupload puede dar array si vienen múltiples
      const file = Array.isArray(up) ? up[0] : up;

      if (!Buffer.isBuffer(file?.data)) {
        return res.status(400).json({
          ok: false,
          message: "No se pudo leer el archivo subido.",
        });
      }

      const parsed = parseExcelRolesPermissions(file.data);
      await seedFromParsed(parsed);

      return res.json({
        ok: true,
        imported: {
          roles: Object.keys(parsed.roles || {}).length,
          permissions: (parsed.permissions || []).length,
        },
      });
    })
  );

  // Error handler dentro del router (al final)
  router.use((err, _req, res, _next) => {
    const status = Number(err?.status || err?.statusCode || 500);
    const code = status >= 400 && status < 600 ? status : 500;

    console.error("[IAM]", err?.stack || err?.message || err);

    res.status(code).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  });

  // ----- Montaje -----
  app.use(basePath, router);
  app.use("/api/iam", router); // legacy alias

  // Alias para DigitalOcean path-trim (/api -> backend)
  if (enableDoAlias) {
    app.use("/iam/v1", router);
  }

  console.log(
    `[IAM] módulo montado en ${basePath} (+ alias /api/iam${
      enableDoAlias ? " + alias /iam/v1" : ""
    })`
  );

  return router;
}