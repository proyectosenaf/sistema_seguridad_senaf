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
import path from "node:path";
import fs from "node:fs";
import nodemailer from "nodemailer";

// Auth opcional
import { requireAuth } from "./middleware/auth.js";

// Core de notificaciones
import { makeNotifier } from "./core/notify.js";
import notificationsRoutes from "./core/notifications.routes.js";

// Módulo Rondas QR
import rondasqr from "../modules/rondasqr/index.js";
import rondasReportsRoutes from "../modules/rondasqr/routes/rondasqr.reports.routes.js";
import rondasOfflineRoutes from "../modules/rondasqr/routes/rondasqr.offline.routes.js";

// Evaluaciones / Incidentes / Acceso / Visitas
import evaluacionesRoutes from "./routes/evaluaciones.routes.js";
import incidentesRoutes from "../modules/incidentes/routes/incident.routes.js";
import accesoRoutes from "../modules/controldeacceso/routes/acceso.routes.js";
import uploadRoutes from "../modules/controldeacceso/routes/upload.routes.js";
import visitasRoutes from "../modules/visitas/visitas.routes.js";

// Cron
import { startDailyAssignmentCron } from "./cron/assignments.cron.js";

// ✅ IAM (la forma correcta)
import { registerIAMModule } from "../modules/iam/index.js";

const app = express();
app.set("trust proxy", 1);

/* ───────────────────── SUPER ADMIN BACKEND ───────────────────── */

const IAM_NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";

// Correos super admin
const ROOT_ADMINS = Array.from(
  new Set(
    [
      ...(process.env.ROOT_ADMINS || "").split(","),
      process.env.SUPERADMIN_EMAIL || "",
    ]
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean)
  )
);

console.log("[iam] ROOT_ADMINS:", ROOT_ADMINS);

function applyRootAdmin(email, rolesArr = [], permsArr = []) {
  const emailNorm = (email || "").toLowerCase();
  const roles = new Set(
    Array.isArray(rolesArr) ? rolesArr.map((r) => String(r).trim()) : []
  );
  const perms = new Set(
    Array.isArray(permsArr) ? permsArr.map((p) => String(p).trim()) : []
  );

  if (emailNorm && ROOT_ADMINS.includes(emailNorm)) {
    roles.add("admin");
    perms.add("*");
    perms.add("iam.users.manage");
    perms.add("iam.roles.manage");
    perms.add("rondasqr.admin");
    perms.add("rondasqr.view");
    perms.add("rondasqr.reports");
    perms.add("incidentes.read");
    perms.add("incidentes.create");
    perms.add("incidentes.edit");
    perms.add("incidentes.reports");
  }

  return {
    roles: Array.from(roles),
    permissions: Array.from(perms),
  };
}

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

app.use(
  cors({
    origin: origins || true,
    credentials: true,
  })
);

/* ─────────────────────── Helmet / Seguridad ───────────────────── */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(compression());

/* ─────────────────────── Parsers de body ──────────────────────── */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
}

/* ─────────────────────── Estáticos / Uploads ──────────────────── */

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

app.use("/uploads", express.static(UPLOADS_ROOT));
app.use("/api/uploads", express.static(UPLOADS_ROOT));

/* ───────────────────────── Health checks ──────────────────────── */

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "senaf-api", ts: Date.now() })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ───────────────────── HTTP + Socket.IO bind ──────────────────── */

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  path: "/socket.io",
  cors: {
    origin: origins || true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
app.use((req, _res, next) => {
  req.io = io;
  next();
});

/* ─────────────────────────── MongoDB ──────────────────────────── */

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error("[db] FALTA MONGODB_URI o MONGO_URI");
  process.exit(1);
}

await mongoose
  .connect(mongoUri, { autoIndex: true })
  .catch((e) => {
    console.error("[db] Error conectando a MongoDB:", e?.message || e);
    process.exit(1);
  });

console.log("[db] MongoDB conectado");

/* ─────────── Bridge Auth payload → req.user (opcional) ─────────── */

function authBridgeToReqUser(req, _res, next) {
  if (!req?.auth?.payload) return next();

  const p = req.auth.payload;
  const email =
    p.email || p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] || null;

  let roles = Array.isArray(p[IAM_NS])
    ? p[IAM_NS]
    : Array.isArray(p.roles)
    ? p.roles
    : [];

  let permissions = Array.isArray(p.permissions) ? p.permissions : [];

  const applied = applyRootAdmin(email, roles, permissions);
  roles = applied.roles;
  permissions = applied.permissions;

  p[IAM_NS] = roles;
  p.roles = roles;
  p.permissions = permissions;

  if (!req.user) {
    req.user = {
      sub: p.sub || "auth|user",
      email,
      [IAM_NS]: roles,
      permissions,
    };
  }

  next();
}

app.use(authBridgeToReqUser);

/* ─────────────────── Auth opcional ─────────────────── */

function optionalAuth(req, res, next) {
  if (req.headers.authorization && String(process.env.DISABLE_AUTH || "0") !== "1") {
    return requireAuth(req, res, next);
  }
  return next();
}

/* ───────────────────── ✅ IAM MODULE REGISTER ✅ ─────────────────────
   Esto crea:
     /api/iam/v1/...
     /api/iam/...
     /iam/v1/...    (alias para DO path trimmed)
*/
await registerIAMModule({ app, basePath: "/api/iam/v1", enableDoAlias: true });

/* ─────────────────── Notificaciones globales ──────────────────── */

const notifier = makeNotifier({ io, mailer: null });
app.set("notifier", notifier);
app.use("/api/notifications", notificationsRoutes);
app.use("/notifications", notificationsRoutes);

startDailyAssignmentCron(app);

/* ──────────────── DEBUG: trigger por URL ─────────────── */

app.get("/api/_debug/ping-assign", (req, res) => {
  const userId = String(req.query.userId || "dev|local");
  const title = String(req.query.title || "Nueva ronda asignada (prueba)");
  const body = String(req.query.body || "Debes comenzar la ronda de prueba en el punto A.");
  io.to(`user-${userId}`).emit("rondasqr:nueva-asignacion", {
    title,
    body,
    meta: { debug: true, ts: Date.now() },
  });
  io.to(`guard-${userId}`).emit("rondasqr:nueva-asignacion", {
    title,
    body,
    meta: { debug: true, ts: Date.now() },
  });
  res.json({ ok: true, sentTo: [`user-${userId}`, `guard-${userId}`] });
});

/* ──────────────── CHAT DUMMY PARA EVITAR 404 ─────────────── */

function chatMessagesHandler(_req, res) {
  res.json({ ok: true, items: [] });
}
app.get("/api/chat/messages", chatMessagesHandler);
app.get("/chat/messages", chatMessagesHandler);

/* ────────────────────── Rondas QR (v1) ─────────────────────── */

const pingHandler = (_req, res) => res.json({ ok: true, where: "/rondasqr/v1/ping" });
const pingCheckinHandler = (_req, res) =>
  res.json({ ok: true, where: "/rondasqr/v1/checkin/ping" });

// Con /api
app.get("/api/rondasqr/v1/ping", pingHandler);
app.get("/api/rondasqr/v1/checkin/ping", pingCheckinHandler);
app.use("/api/rondasqr/v1", rondasqr);
app.use("/api/rondasqr/v1", rondasReportsRoutes);
app.use("/api/rondasqr/v1", rondasOfflineRoutes);

// Sin /api
app.get("/rondasqr/v1/ping", pingHandler);
app.get("/rondasqr/v1/checkin/ping", pingCheckinHandler);
app.use("/rondasqr/v1", rondasqr);
app.use("/rondasqr/v1", rondasReportsRoutes);
app.use("/rondasqr/v1", rondasOfflineRoutes);

/* ───────────────── Control de Acceso ───────────────── */

app.use("/api/acceso", accesoRoutes);
app.use("/acceso", accesoRoutes);

app.use("/api/acceso/uploads", uploadRoutes);
app.use("/acceso/uploads", uploadRoutes);

/* ───────────────── VISITAS ───────────────── */

app.use("/api", visitasRoutes);
app.use("/", visitasRoutes);

/* ───────────────── INCIDENTES ───────────────── */

app.use("/api/incidentes", incidentesRoutes);
app.use("/incidentes", incidentesRoutes);

/* ───────────────── Evaluaciones ───────────────── */

if (process.env.NODE_ENV !== "production") {
  app.use("/api/evaluaciones", (req, _res, next) => {
    if (req.method === "POST") {
      console.log("[debug] POST /api/evaluaciones body:", req.body);
    }
    next();
  });
}

app.use("/evaluaciones", evaluacionesRoutes);
app.use("/api/evaluaciones", evaluacionesRoutes);

/* ────────────────────── Error handler (500) ───────────────────── */

app.use((err, _req, res, _next) => {
  console.error("[api] error:", err?.stack || err?.message || err);
  res.status(err.status || 500).json({
    ok: false,
    error: err?.message || "Internal Server Error",
  });
});

/* ─────────────────────────── 404 final ────────────────────────── */

app.use((_req, res) => res.status(404).json({ ok: false, error: "Not implemented" }));

/* ─────────────────────── Start / Shutdown ─────────────────────── */

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(`[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`);
});

/* ───────────────────────── Socket.IO ──────────────────────────── */

io.on("connection", (s) => {
  console.log("[io] client:", s.id);
  s.emit("hello", { ok: true, ts: Date.now() });

  const joinRooms = (userId) => {
    if (!userId) return;
    s.join(`user-${userId}`);
    s.join(`guard-${userId}`);
    console.log(`[io] ${s.id} joined rooms user-${userId} & guard-${userId}`);
  };

  s.on("join-room", ({ userId }) => joinRooms(userId));
  s.on("join", ({ userId }) => joinRooms(userId));

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

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => console.error("[api] UnhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("[api] UncaughtException:", err));
