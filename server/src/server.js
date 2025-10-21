import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import path from "node:path";
import fs from "node:fs";

// IAM (usuarios/roles/permisos)
import { registerIAMModule } from "../modules/iam/index.js";
// Auth opcional (sólo valida si hay Authorization)
import { requireAuth } from "./middleware/auth.js";

// Módulo Rondas QR
import rondasqr from "../modules/rondasqr/index.js";

const app = express();
app.set("trust proxy", 1);

/* ───────────────────────────── CORS ───────────────────────────── */
function parseOrigins(str) {
  if (!str) return null;
  return String(str)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const devDefaults = ["http://localhost:5173", "http://localhost:3000"];
const origins =
  parseOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN) ||
  (process.env.NODE_ENV !== "production" ? devDefaults : null);

app.use(cors({ origin: origins || true, credentials: true }));

/* ─────────────────────── Helmet / Seguridad ───────────────────── */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(compression());

/* 👇 Unificamos body parser para todo (evita redundancia en el módulo) */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// No cache en DEV
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
}

/* ─────────────────────── Estáticos / Uploads ──────────────────── */
const RONDAS_UPLOADS_DIR = path.resolve("server/modules/rondasqr/uploads");
if (!fs.existsSync(RONDAS_UPLOADS_DIR)) {
  fs.mkdirSync(RONDAS_UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(RONDAS_UPLOADS_DIR));

/* ───────────────────────── Health checks ──────────────────────── */
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "senaf-api", ts: Date.now() }));
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ───────────────────── HTTP + Socket.IO bind ──────────────────── */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: origins || true, methods: ["GET", "POST"], credentials: true },
});
app.use((req, _res, next) => { req.io = io; next(); });

/* ─────────────────────────── MongoDB ──────────────────────────── */
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error("[db] FALTA MONGODB_URI o MONGO_URI");
  process.exit(1);
}
await mongoose.connect(mongoUri, { autoIndex: true }).catch((e) => {
  console.error("[db] Error conectando a MongoDB:", e?.message || e);
  process.exit(1);
});
console.log("[db] MongoDB conectado");

// Fix índice conflictivo en iamusers: username_1 unique con valores null
try {
  const col = mongoose.connection.collection("iamusers");
  const idx = await col.indexes();
  if (idx.some((i) => i.name === "username_1" && i.unique)) {
    await col.dropIndex("username_1");
    console.warn("[iamusers] index username_1 (unique) eliminado");
  }
} catch (e) {
  console.warn("[iamusers] no se pudo revisar/eliminar username_1:", e.message);
}

/* ───────────── DEV headers → payload IAM (opcional) ───────────── */
function iamDevMerge(req, _res, next) {
  const allow = process.env.IAM_ALLOW_DEV_HEADERS === "1";
  if (!allow) return next();

  const devEmail = req.headers["x-user-email"];
  const devRoles = String(req.headers["x-roles"] || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const devPerms = String(req.headers["x-perms"] || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  req.auth = req.auth || { payload: {} };
  const p = req.auth.payload;

  if (devEmail && !p.email) p.email = devEmail;

  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
  const mergedRoles = new Set([...(p[NS] || p.roles || []), ...devRoles]);
  if (mergedRoles.size) {
    p[NS] = Array.from(mergedRoles);
    p.roles = Array.from(mergedRoles);
  }
  const mergedPerms = new Set([...(p.permissions || []), ...devPerms]);
  if (mergedPerms.size) p.permissions = Array.from(mergedPerms);

  next();
}

function optionalAuth(req, res, next) {
  if (req.headers.authorization && process.env.DISABLE_AUTH !== "1") {
    return requireAuth(req, res, next);
  }
  return next();
}

function pickMe(req) {
  const p = req?.auth?.payload || {};
  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
  const email =
    p.email || p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] || null;

  const roles = Array.isArray(p[NS]) ? p[NS] : Array.isArray(p.roles) ? p.roles : [];
  const permissions = Array.isArray(p.permissions) ? p.permissions : [];

  return {
    ok: true,
    user: { email, name: p.name || null, sub: p.sub || null },
    roles,
    permissions,
    _debug:
      process.env.NODE_ENV !== "production"
        ? { NS, hasAuthHeader: !!req.headers.authorization, fromDevHeaders: process.env.IAM_ALLOW_DEV_HEADERS === "1" }
        : undefined,
  };
}

/* ─────────────────── MIDDLEWARES antes del 404 ─────────────────── */
app.use(iamDevMerge);

/* ───────────────────── Stubs simples (UI) ─────────────────────── */
app.get("/api/incidentes", (_req, res) => res.json({ items: [], total: 0 }));
app.post("/api/incidentes", (_req, res) => res.status(201).json({ ok: true }));

/* ───────────── IAM principal + /me ───────────── */
await registerIAMModule({ app, basePath: "/api/iam/v1" });
app.get("/api/iam/v1/auth/me", optionalAuth, (req, res) => res.json(pickMe(req)));
app.get("/api/iam/v1/me",       optionalAuth, (req, res) => res.json(pickMe(req)));
app.get("/api/iam/v1/audit", (_req, res) => res.json({ ok: true, items: [], limit: 100 }));

app.get("/api/notifications/count", (_req, res) => res.json(0));
app.get("/api/chat/messages", (_req, res) => res.json([]));

/* ───────────────────── Módulo Rondas QR (v1) ──────────────────── */
// Este prefijo coincide con el FRONT: http://localhost:4000/api/rondasqr/v1/...
app.use("/api/rondasqr/v1", rondasqr);

/* ─────────────────────────── 404 final ────────────────────────── */
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not implemented" }));

/* ─────────────────────── Start / Shutdown ─────────────────────── */
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

function shutdown(sig) {
  console.log(`[api] ${sig} recibido. Cerrando...`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log("[api] cerrado.");
      process.exit(0);
    });
  });
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => console.error("[api] UnhandledRejection:", err));
process.on("uncaughtException",  (err) => console.error("[api] UncaughtException:",  err));
