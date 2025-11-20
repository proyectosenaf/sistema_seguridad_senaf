// server/modules/iam/index.js (o similar)
import express from "express";
import fileUpload from "express-fileupload";

import { makeAuthMw } from "./utils/auth.util.js";
import { devOr } from "./utils/rbac.util.js";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import permissionsRoutes from "./routes/permissions.routes.js";
import auditRoutes from "./routes/audit.routes.js";

import {
  parseExcelRolesPermissions,
  seedFromParsed,
} from "./utils/seed.util.js";

// Helper para capturar errores async sin try/catch en cada handler
const ah =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Registra el módulo IAM en la app principal de Express.
 *
 * - basePath por defecto: "/api/iam/v1"
 * - Alias legacy: "/api/iam"
 */
export async function registerIAMModule({ app, basePath = "/api/iam/v1" }) {
  const router = express.Router();

  // Body parser SOLO para el módulo (evita límites globales)
  router.use(express.json({ limit: "5mb" }));

  // Auth (JWT si está configurado; en dev puede pasar sin token según makeAuthMw)
  const authMw = makeAuthMw();

  // Subrutas protegidas
  router.use("/auth", authMw, authRoutes);
  router.use("/users", authMw, usersRoutes);
  router.use("/roles", authMw, rolesRoutes);
  router.use("/permissions", authMw, permissionsRoutes);
  router.use("/audit", authMw, auditRoutes);

  // -------- Importar Excel → seed (UI: subir archivo .xlsx) --------
  router.post(
    "/import/excel",
    // Carga de multipart SOLO para esta ruta (5 MB máx)
    fileUpload({
      limits: { fileSize: 5 * 1024 * 1024 },
      abortOnLimit: true,
      useTempFiles: false,
    }),
    // Solo permitido en DEV (o según tu lógica de devOr)
    devOr((_req, _res, next) => next()),
    ah(async (req, res) => {
      // Validaciones básicas
      if (!req.files || !req.files.file) {
        return res
          .status(400)
          .json({ ok: false, message: "Sube un archivo Excel en el campo 'file'." });
      }

      const up = req.files.file;
      const isBuffer = Buffer.isBuffer(up?.data);
      if (!isBuffer) {
        return res
          .status(400)
          .json({ ok: false, message: "No se pudo leer el archivo subido." });
      }

      // Parsear y seedear
      const parsed = parseExcelRolesPermissions(up.data);
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

  // -------- Registro del router en la app --------
  app.use(basePath, router);      // v1 oficial: /api/iam/v1/...
  app.use("/api/iam", router);    // alias legacy: /api/iam/...

  // Manejo de errores SÓLO para este módulo (no tumbar el proceso)
  const errorMw = (err, _req, res, _next) => {
    const status = Number(err?.status || err?.statusCode || 500);
    const code = status >= 400 && status < 600 ? status : 500;

    console.error("[IAM]", err?.stack || err?.message || err);

    res.status(code).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  };

  app.use(basePath, errorMw);
  app.use("/api/iam", errorMw);

  console.log(`[IAM] módulo montado en ${basePath} (+ alias /api/iam)`);
}
