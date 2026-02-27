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

// Importando el middleware para forzar cambio de contraseña
import forcePasswordChange from "./middleware/forcePasswordChange.js";
// (Nota: no lo estás usando aún; no lo activo aquí para no romper flujo)

// ✅ AUTH LOCAL (JWT HS256) – centralizado en IAM utils
import { makeAuthMw } from "../modules/iam/utils/auth.util.js";

// IAM context builder
import { buildContextFrom } from "../modules/iam/utils/rbac.util.js";

// ✅ Auth OTP (visitantes) desde IAM (sin módulo public)
import iamOtpAuthRoutes from "../modules/iam/routes/auth.otp.routes.js";

// Core de notificaciones
import { makeNotifier } from "./core/notify.js";
import notificationsRoutes from "./core/notifications.routes.js";

// Módulo Rondas QR
import rondasqr from "../modules/rondasqr/index.js";
import rondasReportsRoutes from "../modules/rondasqr/routes/rondasqr.reports.routes.js";
import rondasOfflineRoutes from "../modules/rondasqr/routes/rondasqr.offline.routes.js";

// Incidentes / Acceso / Visitas
import incidentesRoutes from "../modules/incidentes/routes/incident.routes.js";
import accesoRoutes from "../modules/controldeacceso/routes/acceso.routes.js";
import uploadRoutes from "../modules/controldeacceso/routes/upload.routes.js";
import visitasRoutes from "../modules/visitas/visitas.routes.js";

// ✅ Chat
import chatRoutes from "./routes/chat.routes.js";

// Cron
import { startDailyAssignmentCron } from "./cron/assignments.cron.js";

// ✅ IAM
import { registerIAMModule } from "../modules/iam/index.js";

const app = express();
app.set("trust proxy", 1);

/* ───────────────────── ENV / MODOS ───────────────────── */

const IS_PROD = process.env.NODE_ENV === "production";
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";
const DEV_OPEN = String(process.env.DEV_OPEN || (DISABLE_AUTH ? "1" : "0")) === "1";

console.log("[env] NODE_ENV:", process.env.NODE_ENV);
console.log("[env] DISABLE_AUTH:", DISABLE_AUTH ? "1" : "0");
console.log("[env] DEV_OPEN:", DEV_OPEN ? "1" : "0");

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
  (!IS_PROD ? devDefaults : null);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!origins || origins.length === 0) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  })
);

/* ─────────────────────── Helmet / Seguridad ───────────────────── */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

if (!IS_PROD) app.use(morgan("dev"));
app.use(compression());

/* ─────────────────────── Parsers de body ──────────────────────── */
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

if (!IS_PROD) {
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
}

/* ─────────────────────── DEV IDENTITY GLOBAL ───────────────────── */
function devIdentity(req, _res, next) {
  if (IS_PROD) return next();
  if (!(DEV_OPEN || DISABLE_AUTH)) return next();

  const email = (
    req.header("x-user-email") ||
    process.env.SUPERADMIN_EMAIL ||
    "dev@local"
  )
    .toLowerCase()
    .trim();

  // ✅ en dev, simulamos identidad (sub/email)
  req.authUser = { sub: "dev|local", email, name: "DEV USER" };

  req.auth = req.auth || {};
  req.auth.payload = {
    sub: req.authUser.sub,
    email: req.authUser.email,
    name: req.authUser.name,
    provider: "local",
  };

  return next();
}
app.use(devIdentity);

/* ─────────────────────── Estáticos / Uploads ──────────────────── */

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

app.use("/uploads", express.static(UPLOADS_ROOT));
app.use("/api/uploads", express.static(UPLOADS_ROOT));

/* ───────────────────────── Health checks ──────────────────────── */

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    service: "senaf-api",
    ts: Date.now(),
    env: process.env.NODE_ENV,
    devOpen: DEV_OPEN,
    disableAuth: DISABLE_AUTH,
  })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ───────────────────── ✅ PUBLIC AUTH (VISITANTES) ✅ ───────────────────── */
/**
 * Visitantes: OTP por email
 * ✅ SIN módulo public duplicado: usamos el router OTP de IAM como “public”
 *
 * Nota: este router debe NO requerir auth (por diseño OTP).
 */
app.use("/api/public/v1/auth", iamOtpAuthRoutes);
app.use("/public/v1/auth", iamOtpAuthRoutes);

/* ───────────────────── HTTP + Socket.IO bind ──────────────────── */

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  path: "/socket.io",
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!origins || origins.length === 0) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error(`Socket.IO CORS blocked for origin: ${origin}`), false);
    },
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

mongoose.set("bufferCommands", false);

mongoose.connection.on("error", (e) =>
  console.error("[db] mongoose error:", e?.message || e)
);
mongoose.connection.on("disconnected", () =>
  console.warn("[db] mongoose disconnected")
);

await mongoose
  .connect(mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 15000,
  })
  .catch((e) => {
    console.error("[db] Error conectando a MongoDB:", e?.message || e);
    process.exit(1);
  });

console.log("[db] MongoDB conectado");

/* ─────────────────── Auth opcional (GLOBAL) ──────────────────── */

/**
 * ✅ AUTH LOCAL:
 * - Si hay Authorization Bearer => valida y deja req.auth.payload
 * - Si no hay Bearer => visitor (pasa)
 */
const requireAuth = makeAuthMw();

function optionalAuth(req, res, next) {
  if (DISABLE_AUTH) return next();
  const h = String(req.headers.authorization || "");
  if (h.toLowerCase().startsWith("bearer ")) return requireAuth(req, res, next);
  return next();
}
app.use(optionalAuth);

/**
 * 1) Adjunta usuario normalizado desde req.auth.payload -> req.user (local)
 */
function attachAuthUser(req, _res, next) {
  if (req?.auth?.payload) {
    req.user = {
      sub: req.auth.payload.sub || null,
      email: req.auth.payload.email || null,
      name: req.auth.payload.name || null,
      provider: req.auth.payload.provider || "local",
    };
  }
  next();
}
app.use(attachAuthUser);

/**
 * 2) Construye contexto IAM en req.iam si hay señales de identidad
 * ✅ roles/perms 100% desde DB (IamUser + IamRole)
 */
app.use(async (req, _res, next) => {
  try {
    const hasPayload = !!req?.auth?.payload;
    const hasBearer = String(req.headers.authorization || "")
      .toLowerCase()
      .startsWith("bearer ");
    const hasDevEmail = !!req.headers["x-user-email"];

    if (!(hasPayload || hasBearer || hasDevEmail)) return next();

    req.iam = await buildContextFrom(req);
    return next();
  } catch (e) {
    return next(e);
  }
});

/* ───────────────────── ✅ IAM MODULE REGISTER ✅ ───────────────────── */
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

/* ───────────────────── ✅ CHAT REAL (API) ✅ ───────────────────── */
app.use("/api/chat", chatRoutes);
app.use("/chat", chatRoutes);

/* ────────────────────── Rondas QR (v1) ─────────────────────── */

const pingHandler = (_req, res) => res.json({ ok: true, where: "/rondasqr/v1/ping" });
const pingCheckinHandler = (_req, res) => res.json({ ok: true, where: "/rondasqr/v1/checkin/ping" });

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

// Alias compatibles
app.use("/api/rondasqr/v1/incidentes", incidentesRoutes);
app.use("/rondasqr/v1/incidentes", incidentesRoutes);



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

const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(`[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`);
  console.log(`[io] path: ${io?.opts?.path || "/socket.io"}`);
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

  s.on("chat:join", ({ room = "global" } = {}) => {
    s.join(`chat:${room}`);
    s.emit("chat:joined", { room });
  });

  s.on("chat:leave", ({ room = "global" } = {}) => {
    s.leave(`chat:${room}`);
    s.emit("chat:left", { room });
  });

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