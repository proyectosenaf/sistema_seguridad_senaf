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

import { parseExcelRolesPermissions, seedFromParsed } from "./utils/seed.util.js";

const ah =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export async function registerIAMModule({
  app,
  basePath = "/api/iam/v1",
  enableLegacyRedirects = false,
  jsonLimit = "5mb",
} = {}) {
  if (!app) throw new Error("[IAM] registerIAMModule requiere { app }");

  const router = express.Router();

  router.use(express.json({ limit: jsonLimit }));

  // Anti-cache
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // OPTIONS preflight rápido
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

  // 🔥 SOLO ESTAS DOS (authRoutes NO EXISTE)
  router.use("/auth", authOtpRoutes);
  router.use("/auth", registerVisitorRoutes);

  /* ================= ME ================= */

  router.use("/me", authOptional, meRoutes);

  /* ================= ADMIN ================= */

  router.use("/users", authMw, usersRoutes);
  router.use("/roles", authMw, rolesRoutes);
  router.use("/permissions", authMw, permissionsRoutes);
  router.use("/audit", authMw, auditRoutes);

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
        return res.status(400).json({
          ok: false,
          message: "Sube un archivo Excel en el campo 'file'.",
        });
      }

      const file = Array.isArray(up) ? up[0] : up;

      if (!Buffer.isBuffer(file?.data)) {
        return res.status(400).json({
          ok: false,
          message: "No se pudo leer el archivo.",
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

  /* ================= ERROR HANDLER ================= */

  router.use((err, _req, res, _next) => {
    console.error("[IAM]", err?.stack || err);
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