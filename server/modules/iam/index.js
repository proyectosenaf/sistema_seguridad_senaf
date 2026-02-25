// server/modules/iam/index.js
import express from "express";
import fileUpload from "express-fileupload";

import { makeAuthMw } from "./utils/auth.util.js";
import { makeOptionalAuthMw } from "./utils/optionalAuth.util.js"; // ✅ NUEVO
import { devOr } from "./utils/rbac.util.js";

import authRoutes from "./routes/auth.routes.js";
import authOtpRoutes from "./routes/auth.otp.routes.js"; // ✅ NUEVO
import preloginRoutes from "./routes/prelogin.routes.js"; // ✅ NUEVO

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

  // Preflight defensivo
  router.use((req, res, next) => {
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Auth middleware
  const authMw = makeAuthMw();
  const authOptional = makeOptionalAuthMw();

  // Ping
  router.get("/_ping", (_req, res) =>
    res.json({ ok: true, module: "iam", version: "v1" })
  );

  // AUTH público
  router.use("/auth", authRoutes);

  // AUTH OTP empleados
  router.use("/auth", authOtpRoutes);

  // ✅ PRELOGIN (PROTEGIDO con Auth0 token)
  // endpoints:
  // POST /api/iam/v1/auth/temp/verify
  // POST /api/iam/v1/auth/password/change
  router.use("/auth", authMw, preloginRoutes);

  // /me con auth opcional
  router.use("/me", authOptional, meRoutes);

  // Rutas protegidas (admin/gestión)
  router.use("/users", authMw, usersRoutes);
  router.use("/roles", authMw, rolesRoutes);
  router.use("/permissions", authMw, permissionsRoutes);
  router.use("/audit", authMw, auditRoutes);

  // Import Excel
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

  // Error handler
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