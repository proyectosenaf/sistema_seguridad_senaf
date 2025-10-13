// server/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";

import { registerRondasModule } from "../modules/rondas/index.js";
import { registerIAMModule } from "../modules/iam/index.js";
import { iamEnrich } from "../modules/iam/utils/rbac.util.js";

// ⬇️ IMPORTA requireAuth para validar JWT cuando venga Authorization
import { requireAuth } from "./middleware/auth.js";

const app = express();
app.set("trust proxy", 1);

// -------- CORS --------
function parseOrigins(str) {
  if (!str) return null;
  return String(str).split(",").map(s => s.trim()).filter(Boolean);
}
const devDefaults = ["http://localhost:5173", "http://localhost:3000"];
const origins =
  parseOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN) ||
  (process.env.NODE_ENV !== "production" ? devDefaults : null);

app.use(cors({ origin: origins || true, credentials: true }));
app.use(helmet());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(compression());
app.use(express.json({ limit: "2mb" }));

// -------- Health --------
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "senaf-api", ts: Date.now() })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

// -------- HTTP + Socket.IO --------
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: origins || true, methods: ["GET", "POST"], credentials: true },
});
app.use((req, _res, next) => { req.io = io; next(); });

// -------- MongoDB --------
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error("[db] FALTA MONGODB_URI/MONGO_URI en variables de entorno");
  process.exit(1);
}
await mongoose.connect(mongoUri, { autoIndex: true });
console.log("[db] MongoDB conectado");

// =====================================================================================
// IAM DEV MERGE: fusiona cabeceras DEV a req.auth.payload (si IAM_ALLOW_DEV_HEADERS=1)
// =====================================================================================
function iamDevMerge(req, _res, next) {
  const allow = process.env.IAM_ALLOW_DEV_HEADERS === "1";
  if (!allow) return next();

  const devEmail = req.headers["x-user-email"];
  const devRoles = (req.headers["x-roles"] || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const devPerms = (req.headers["x-perms"] || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  // Asegura estructura
  req.auth = req.auth || { payload: {} };
  const p = req.auth.payload;

  // Email
  if (devEmail && !p.email) p.email = devEmail;

  // Roles en namespace y en roles plano (compatibilidad)
  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
  const mergedRoles = new Set([...(p[NS] || p.roles || []), ...devRoles]);
  if (mergedRoles.size) {
    p[NS] = Array.from(mergedRoles);
    p.roles = Array.from(mergedRoles);
  }

  // Permisos
  const mergedPerms = new Set([...(p.permissions || []), ...devPerms]);
  if (mergedPerms.size) {
    p.permissions = Array.from(mergedPerms);
  }

  next();
}

// ============================================================
// OPTIONAL AUTH: valida JWT solo si viene Authorization header
// ============================================================
function optionalAuth(req, res, next) {
  if (req.headers.authorization && process.env.DISABLE_AUTH !== "1") {
    return requireAuth(req, res, next);
  }
  return next();
}

// ===============================
// pickMe: arma respuesta uniforme
// ===============================
function pickMe(req) {
  const p = req?.auth?.payload || {};
  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";

  const email =
    p.email ||
    p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] ||
    null;

  const roles = Array.isArray(p[NS]) ? p[NS]
              : Array.isArray(p.roles) ? p.roles
              : [];

  const permissions = Array.isArray(p.permissions) ? p.permissions : [];

  return {
    ok: true,
    user: { email, name: p.name || null, sub: p.sub || null },
    roles,
    permissions,
    _debug: process.env.NODE_ENV !== "production" ? {
      NS,
      hasAuthHeader: !!req.headers.authorization,
      fromDevHeaders: process.env.IAM_ALLOW_DEV_HEADERS === "1",
    } : undefined,
  };
}

// -------- Módulos antes del 404 (¡importante!) --------
// Rondas
registerRondasModule({ app, io, basePath: "/api/rondas/v1" });

// Enriquecer req con headers DEV (si los mandas)
app.use(iamEnrich);      // tu enriquecedor actual
app.use(iamDevMerge);    // <-- añade este merge para DEV

// IAM (usuarios/roles/permisos)
await registerIAMModule({ app, basePath: "/api/iam/v1" });

// Endpoints /me robustos (funcionan con y sin JWT en DEV)
app.get("/api/iam/v1/auth/me", optionalAuth, (req, res) => res.json(pickMe(req)));
app.get("/api/iam/v1/me",       optionalAuth, (req, res) => res.json(pickMe(req)));

// --- Stubs para quitar 404 del UI (opcionales) ---
app.get("/api/notifications/count", (_req, res) => res.json(0));
app.get("/api/chat/messages",      (_req, res) => res.json([]));

// -------- 404: SIEMPRE al final --------
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not implemented" }));

// -------- Start/Shutdown --------
const PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(`[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`);
});
io.on("connection", (s) => {
  console.log("[io] client:", s.id);
  s.emit("hello", { ok: true, ts: Date.now() });
  s.on("disconnect", () => console.log("[io] bye:", s.id));
});

// Manejo de errores
process.on("unhandledRejection", (err) => console.error("[api] UnhandledRejection:", err));
process.on("uncaughtException",  (err) => console.error("[api] UncaughtException:", err));
