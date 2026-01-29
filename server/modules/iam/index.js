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
 */
export async function registerIAMModule({
  app,
  basePath = "/api/iam/v1",
  enableDoAlias = true,
} = {}) {
  const router = express.Router();

  router.use(express.json({ limit: "5mb" }));

  const authMw = makeAuthMw();

  // Ping para probar montaje
  router.get("/_ping", (_req, res) =>
    res.json({ ok: true, module: "iam", version: "v1" })
  );

  // ME protegido
  router.use("/me", authMw, meRoutes);

  // AUTH público para /login (lo proteges por ruta si quieres)
  router.use("/auth", authRoutes);

  // resto protegido
  router.use("/users", authMw, usersRoutes);
  router.use("/roles", authMw, rolesRoutes);
  router.use("/permissions", authMw, permissionsRoutes);
  router.use("/audit", authMw, auditRoutes);

  // Import excel (solo dev)
  router.post(
    "/import/excel",
    fileUpload({
      limits: { fileSize: 5 * 1024 * 1024 },
      abortOnLimit: true,
      useTempFiles: false,
    }),
    devOr((_req, _res, next) => next()),
    ah(async (req, res) => {
      if (!req.files || !req.files.file) {
        return res.status(400).json({
          ok: false,
          message: "Sube un archivo Excel en el campo 'file'.",
        });
      }

      const up = req.files.file;
      const isBuffer = Buffer.isBuffer(up?.data);
      if (!isBuffer) {
        return res.status(400).json({
          ok: false,
          message: "No se pudo leer el archivo subido.",
        });
      }

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

  // Error handler dentro del router
  router.use((err, _req, res, _next) => {
    const status = Number(err?.status || err?.statusCode || 500);
    const code = status >= 400 && status < 600 ? status : 500;

    console.error("[IAM]", err?.stack || err?.message || err);

    res.status(code).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  });

  // Montaje
  app.use(basePath, router);
  app.use("/api/iam", router); // legacy alias

  // ✅ Alias para DigitalOcean Path trimmed (/api -> backend)
  // Si DO te recorta "/api", entonces /api/iam/v1/... llega como /iam/v1/...
  if (enableDoAlias) {
    app.use("/iam/v1", router);
  }

  console.log(
    `[IAM] módulo montado en ${basePath} (+ alias /api/iam${
      enableDoAlias ? " + alias /iam/v1" : ""
    })`
  );
}
