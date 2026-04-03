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

import { registerSystemModule, bootSystemModule } from "./modules/system/index.js";

// ✅ AUTH LOCAL (JWT HS256) – centralizado en IAM utils
import { makeAuthMw } from "../modules/iam/utils/auth.util.js";

// IAM context builder
import { buildContextFrom } from "../modules/iam/utils/rbac.util.js";

// ✅ Auth OTP PÚBLICO (visitantes / empleados) desde IAM
import iamOtpAuthRoutes from "../modules/iam/routes/auth.otp.routes.js";

// ✅ PASSWORD RESET PÚBLICO
import passwordResetRoutes from "../modules/iam/routes/password-reset.routes.js";

// ✅ Force change password
import forcePasswordChange from "./middleware/forcePasswordChange.js";

// Core de notificaciones
import { makeNotifier } from "./core/notify.js";
import notificationsRoutes from "./core/notifications.routes.js";

// Módulo Rondas QR
import rondasqr from "../modules/rondasqr/index.js";
import rondasReportsRoutes from "../modules/rondasqr/routes/rondasqr.reports.routes.js";
import rondasOfflineRoutes from "../modules/rondasqr/routes/rondasqr.offline.routes.js";

// Incidentes / Acceso / Visitas
import incidentesRoutes from "../modules/incidentes/routes/incident.routes.js";
import accesoCatalogosRoutes from "../modules/controldeacceso/routes/catalogos.routes.js";
import accesoRoutes from "../modules/controldeacceso/routes/acceso.routes.js";
import uploadRoutes from "../modules/controldeacceso/routes/upload.routes.js";
import visitasRoutes from "../modules/visitas/visitas.routes.js";

// ✅ Bitácora
import bitacoraRouter from "../modules/bitacora/routes/bitacora.routes.js";

// ✅ Chat
import chatRoutes from "./routes/chat.routes.js";

// Cron
import { startDailyAssignmentCron } from "./cron/assignments.cron.js";

// ✅ IAM
import { registerIAMModule } from "../modules/iam/index.js";

// ✅ Catálogos IAM
import catalogsRoutes from "../modules/iam/routes/catalogs.routes.js";

// ✅ Sync de permisos al arrancar
import { syncPermissionsCatalog } from "../modules/iam/services/permissions.sync.service.js";

// ✅ Search global
import searchRoutes from "../modules/search/search.routes.js";

const app = express();

app.set("trust proxy", 1);
app.set("etag", false);

/* ───────────────────── ENV / MODOS ───────────────────── */

const IS_PROD = process.env.NODE_ENV === "production";
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";
const DEV_OPEN =
  String(process.env.DEV_OPEN || (DISABLE_AUTH ? "1" : "0")) === "1";

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

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!origins || origins.length === 0) return cb(null, true);
    if (origins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-user-email",
    "x-user-roles",
    "x-user-perms",
    "x-roles",
    "x-perms",
    "Cache-Control",
    "Pragma",
    "Expires",
    "X-Requested-With",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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

/**
 * ✅ Anti-cache para TODA la API
 */
app.use("/api", (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

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

const staticUploadsOptions = {
  etag: false,
  maxAge: 0,
  fallthrough: true,
};

app.use("/uploads", express.static(UPLOADS_ROOT, staticUploadsOptions));
app.use("/api/uploads", express.static(UPLOADS_ROOT, staticUploadsOptions));

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

/* ───────────────────── ✅ AUTH OTP PÚBLICO ✅ ───────────────────── */

app.use("/api/public/v1/auth", iamOtpAuthRoutes);
app.use("/public/v1/auth", iamOtpAuthRoutes);

/* ───────────────────── ✅ PASSWORD RESET PÚBLICO ✅ ───────────────────── */

app.use("/api/public/v1/password", passwordResetRoutes);
app.use("/public/v1/password", passwordResetRoutes);

/* ───────────────────── HTTP + Socket.IO bind ──────────────────── */

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  path: "/socket.io",
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!origins || origins.length === 0) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(
        new Error(`Socket.IO CORS blocked for origin: ${origin}`),
        false
      );
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

/* ───────────────────── ✅ SYSTEM MODULE REGISTER ✅ ───────────────────── */

registerSystemModule(app);

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

try {
  const syncResult = await syncPermissionsCatalog();
  console.log("[IAM] permisos sincronizados:", syncResult);
} catch (e) {
  console.error("[IAM] error sincronizando permisos:", e?.message || e);
}

bootSystemModule();

/* ─────────────────── Auth opcional (GLOBAL) ──────────────────── */

const requireAuth = makeAuthMw();

function optionalAuth(req, res, next) {
  if (DISABLE_AUTH) return next();

  const h = String(req.headers.authorization || "");
  if (h.toLowerCase().startsWith("bearer ")) {
    return requireAuth(req, res, next);
  }

  return next();
}
app.use(optionalAuth);

function readClaimArray(payload, ...keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }
  return [];
}

function readClaimObject(payload, ...keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return {};
}

function attachAuthUser(req, _res, next) {
  if (req?.auth?.payload) {
    const payload = req.auth.payload;

    req.user = {
      sub: payload.sub || null,
      email: payload.email || null,
      name: payload.name || null,
      provider: payload.provider || "local",
      roles: readClaimArray(payload, "roles", "role", "https://senaf/roles"),
      perms: readClaimArray(payload, "perms", "permissions", "https://senaf/perms"),
      can: readClaimObject(payload, "can", "https://senaf/can"),
    };
  }
  next();
}
app.use(attachAuthUser);

/* ─────────────────── Force change password ──────────────────── */

app.use(forcePasswordChange);

/**
 * ✅ Construye req.iam solo cuando realmente hay identidad.
 * No rompe públicos, no recalcula si ya existe.
 */
app.use(async (req, _res, next) => {
  try {
    if (req.iam) return next();

    const hasPayload = !!req?.auth?.payload;
    const hasBearer = String(req.headers.authorization || "")
      .toLowerCase()
      .startsWith("bearer ");
    const hasDevEmail = !!req.headers["x-user-email"];

    if (!(hasPayload || hasBearer || hasDevEmail)) {
      return next();
    }

    req.iam = await buildContextFrom(req);
    return next();
  } catch (e) {
    return next(e);
  }
});

/* ───────────────────── ✅ IAM MODULE REGISTER ✅ ───────────────────── */

await registerIAMModule({
  app,
  basePath: "/api/iam/v1",
  enableLegacyRedirects: false,
});

/* ───────────────────── ✅ CATÁLOGOS REGISTER ✅ ───────────────────── */

app.use("/api/catalogos", accesoCatalogosRoutes);

app.use("/api/iam/v1/catalogs", catalogsRoutes);
app.use("/iam/v1/catalogs", catalogsRoutes);

/* ─────────────────── Notificaciones globales ──────────────────── */

const notifier = makeNotifier({ io, mailer: null });
app.set("notifier", notifier);
app.use("/api/notifications", notificationsRoutes);
app.use("/notifications", notificationsRoutes);

/* ─────────────────── Search global ──────────────────── */

app.use("/api/search", searchRoutes);
app.use("/search", searchRoutes);

startDailyAssignmentCron(app);

/* ──────────────── DEBUG: trigger por URL ─────────────── */

app.get("/api/_debug/ping-assign", (req, res) => {
  const userId = String(req.query.userId || "dev|local");
  const title = String(req.query.title || "Nueva ronda asignada (prueba)");
  const body = String(
    req.query.body || "Debes comenzar la ronda de prueba en el punto A."
  );

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

const pingHandler = (_req, res) =>
  res.json({ ok: true, where: "/rondasqr/v1/ping" });
const pingCheckinHandler = (_req, res) =>
  res.json({ ok: true, where: "/rondasqr/v1/checkin/ping" });

console.log("[routes] mount rondasqr -> /api/rondasqr/v1 y /rondasqr/v1");

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

/* ───────────────── BITÁCORA ───────────────── */

app.use("/api/bitacora", bitacoraRouter);
app.use("/bitacora", bitacoraRouter);

/* ────────────────────── Error handler (500) ───────────────────── */

app.use((err, _req, res, _next) => {
  console.error("[api] error:", err?.stack || err?.message || err);
  res.status(err.status || 500).json({
    ok: false,
    error: err?.message || "Internal Server Error",
  });
});

/* ───────────────────── 404 específico QR admin ───────────────────── */

app.use("/api/rondasqr/v1/admin", (req, res, next) => {
  if (/^\/points\/[^/]+\/qr\/?$/.test(req.path)) {
    console.warn("[404][rondasqr-admin-qr]", {
      method: req.method,
      path: req.originalUrl,
    });

    return res.status(404).json({
      ok: false,
      error: "Not implemented",
      method: req.method,
      path: req.originalUrl,
      hint: "La ruta DELETE /admin/points/:id/qr no está siendo alcanzada en el backend activo.",
    });
  }

  return next();
});

/* ─────────────────────────── 404 final ────────────────────────── */

app.use((req, res) =>
  res.status(404).json({
    ok: false,
    error: "Not implemented",
    method: req.method,
    path: req.originalUrl,
  })
);

/* ─────────────────────── Start / Shutdown ─────────────────────── */

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(`[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`);
  console.log(`[io] path: ${io?.opts?.path || "/socket.io"}`);
});

/* ───────────────────────── Socket.IO helpers ──────────────────────────── */

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function normalizeRoleName(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function normalizeRoles(input) {
  const raw = toArray(input)
    .flatMap((x) => {
      if (Array.isArray(x)) return x;
      if (x?.roles && Array.isArray(x.roles)) return x.roles;
      return [x];
    })
    .map(normalizeRoleName)
    .filter(Boolean);

  return [...new Set(raw)];
}

function cleanChatRoom(v) {
  const raw = String(v || "global").trim();
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, "");
  return safe || "global";
}

function cleanIdentityValue(v) {
  const s = String(v || "").trim();
  return s || "";
}

function buildPrivateChatRoom(a, b) {
  const left = cleanIdentityValue(a);
  const right = cleanIdentityValue(b);
  if (!left || !right) return null;
  const pair = [left, right].sort((x, y) => x.localeCompare(y));
  return `chat:private:${pair[0]}__${pair[1]}`;
}

function joinRoomsByIdentity(socket, identity = {}) {
  const rawUserId =
    identity?.userId ??
    identity?.id ??
    identity?._id ??
    identity?.sub ??
    "";

  const userId = rawUserId ? String(rawUserId).trim() : "";

  const email = identity?.email
    ? String(identity.email).trim().toLowerCase()
    : "";

  const roles = normalizeRoles(
    identity?.roles || identity?.role || identity?.rol || []
  );

  const joinedRooms = new Set();

  function joinSafe(room) {
    const r = String(room || "").trim();
    if (!r || joinedRooms.has(r)) return;
    socket.join(r);
    joinedRooms.add(r);
  }

  if (userId) {
    joinSafe(`user-${userId}`);
    joinSafe(`guard-${userId}`);
  }

  if (email) {
    joinSafe(`email:${email}`);
  }

  for (const role of roles) {
    joinSafe(`role:${role}`);
  }

  socket.data = socket.data || {};
  socket.data.identity = {
    userId,
    email,
    roles,
    joinedAt: Date.now(),
  };

  console.log("[io] identity joined:", {
    socketId: socket.id,
    userId,
    email,
    roles,
    rooms: Array.from(joinedRooms),
  });
}

function getSocketIdentity(socket) {
  return socket?.data?.identity || { userId: "", email: "", roles: [] };
}

function resolveIdentityPayload(payload = {}) {
  return {
    userId:
      payload?.userId ||
      payload?.id ||
      payload?._id ||
      payload?.sub ||
      "",
    email: payload?.email || "",
    roles: payload?.roles || payload?.role || payload?.rol || [],
  };
}

/* ───────────────────────── Socket.IO ──────────────────────────── */

io.on("connection", (s) => {
  console.log("[io] client:", s.id);
  s.emit("hello", { ok: true, ts: Date.now() });

  const joinRoomsLegacy = (userId) => {
    if (!userId) return;
    s.join(`user-${userId}`);
    s.join(`guard-${userId}`);
    console.log(`[io] ${s.id} joined rooms user-${userId} & guard-${userId}`);
  };

  const buildCoordsText = (lat, lon) => {
    const nLat = Number(lat);
    const nLon = Number(lon);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return "";
    return `${nLat}, ${nLon}`;
  };

  const buildMapLinks = (lat, lon) => {
    const coordsText = buildCoordsText(lat, lon);
    if (!coordsText) {
      return {
        coordsText: "",
        googleMapsUrl: "",
        wazeUrl: "",
      };
    }

    return {
      coordsText,
      googleMapsUrl: `https://www.google.com/maps?q=${encodeURIComponent(
        coordsText
      )}`,
      wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(
        coordsText
      )}&navigate=yes`,
    };
  };

  const normalizeGuard = (payload = {}, identity = {}) => {
    const guard =
      payload?.guard && typeof payload.guard === "object" ? payload.guard : {};

    const id =
      guard?.id ||
      payload?.guardId ||
      identity?.userId ||
      payload?.userId ||
      null;

    const name =
      guard?.name ||
      payload?.guardName ||
      payload?.user ||
      payload?.fromName ||
      "";

    const email =
      guard?.email ||
      payload?.guardEmail ||
      identity?.email ||
      payload?.email ||
      "";

    const role =
      guard?.role ||
      payload?.guardRole ||
      (Array.isArray(identity?.roles) ? identity.roles.join(", ") : "") ||
      "";

    return {
      id: id ? String(id) : null,
      name: String(name || "").trim(),
      email: String(email || "").trim(),
      role: String(role || "").trim(),
    };
  };

  const normalizePanicEvent = (payload = {}) => {
    const now = Date.now();
    const identity = getSocketIdentity(s);
    const roles = normalizeRoles(identity.roles);
    const guard = normalizeGuard(payload, identity);

    const rawGps =
      payload?.gps && typeof payload.gps === "object"
        ? payload.gps
        : payload?.location && typeof payload.location === "object"
          ? payload.location
          : {};

    const lat = Number(
      rawGps?.lat ?? rawGps?.latitude ?? payload?.lat ?? payload?.latitude
    );
    const lon = Number(
      rawGps?.lon ??
        rawGps?.lng ??
        rawGps?.longitude ??
        payload?.lon ??
        payload?.lng ??
        payload?.longitude
    );

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    const linkData = hasCoords
      ? buildMapLinks(lat, lon)
      : buildMapLinks(null, null);

    const accuracyRaw =
      rawGps?.accuracy ?? payload?.accuracy ?? payload?.location?.accuracy ?? null;

    const event = {
      ok: true,
      kind: "panic",
      type: "panic",
      ts: now,
      emittedAt: payload?.emittedAt || new Date(now).toISOString(),
      fromSocketId: s.id,
      fromUserId: identity.userId || payload?.userId || guard.id || null,
      fromEmail: identity.email || payload?.email || guard.email || null,
      fromRoles: roles,
      source: payload?.source || payload?.module || "rondasqr.panic",
      title: payload?.title || "🚨 Alerta de pánico",
      message:
        payload?.message ||
        payload?.body ||
        payload?.incidentText ||
        "Se activó el botón de pánico",
      body:
        payload?.body ||
        payload?.message ||
        payload?.incidentText ||
        "Se activó el botón de pánico",
      incidentText:
        payload?.incidentText ||
        payload?.message ||
        payload?.body ||
        "Se activó el botón de pánico",
      area: payload?.area || payload?.module || "Rondas de Vigilancia",
      priority: payload?.priority || "critical",
      playSound: payload?.playSound !== false,
      guard,
      guardId: guard.id,
      guardName: guard.name,
      guardEmail: guard.email,
      gps: hasCoords
        ? {
            lat,
            lon,
            accuracy:
              accuracyRaw == null || accuracyRaw === ""
                ? null
                : Number(accuracyRaw),
            altitude:
              rawGps?.altitude == null || rawGps?.altitude === ""
                ? null
                : Number(rawGps.altitude),
            heading:
              rawGps?.heading == null || rawGps?.heading === ""
                ? null
                : Number(rawGps.heading),
            speed:
              rawGps?.speed == null || rawGps?.speed === ""
                ? null
                : Number(rawGps.speed),
            capturedAt:
              rawGps?.capturedAt ||
              payload?.emittedAt ||
              new Date(now).toISOString(),
            source: rawGps?.source || "socket-client",
            coordsText: rawGps?.coordsText || linkData.coordsText || "",
          }
        : null,
      location: hasCoords
        ? {
            lat,
            lon,
            accuracy:
              accuracyRaw == null || accuracyRaw === ""
                ? null
                : Number(accuracyRaw),
            coordsText:
              payload?.location?.coordsText ||
              rawGps?.coordsText ||
              linkData.coordsText ||
              "",
            googleMapsUrl:
              payload?.location?.googleMapsUrl ||
              payload?.googleMapsUrl ||
              linkData.googleMapsUrl ||
              "",
            wazeUrl:
              payload?.location?.wazeUrl ||
              payload?.wazeUrl ||
              linkData.wazeUrl ||
              "",
            capturedAt:
              rawGps?.capturedAt ||
              payload?.emittedAt ||
              new Date(now).toISOString(),
          }
        : null,
      links: {
        googleMapsUrl:
          payload?.links?.googleMapsUrl ||
          payload?.location?.googleMapsUrl ||
          payload?.googleMapsUrl ||
          linkData.googleMapsUrl ||
          "",
        wazeUrl:
          payload?.links?.wazeUrl ||
          payload?.location?.wazeUrl ||
          payload?.wazeUrl ||
          linkData.wazeUrl ||
          "",
      },
      ...payload,
    };

    return event;
  };

  s.on("join-room", ({ userId } = {}) => {
    joinRoomsLegacy(userId);
  });

  s.on("join", (payload = {}) => {
    const identity = resolveIdentityPayload(payload);
    joinRoomsLegacy(identity.userId);
    joinRoomsByIdentity(s, identity);

    s.emit("join:ok", {
      ok: true,
      socketId: s.id,
      identity: getSocketIdentity(s),
    });
  });

  s.on("presence:join", (payload = {}) => {
    const identity = resolveIdentityPayload(payload);
    joinRoomsLegacy(identity.userId);
    joinRoomsByIdentity(s, identity);

    s.emit("presence:joined", {
      ok: true,
      socketId: s.id,
      identity: getSocketIdentity(s),
    });

    console.log("[io][presence] joined:", {
      socketId: s.id,
      userId: identity.userId,
      email: identity.email,
      roles: identity.roles,
    });
  });

  s.on("auth:join", (payload = {}) => {
    const identity = resolveIdentityPayload(payload);
    joinRoomsLegacy(identity.userId);
    joinRoomsByIdentity(s, identity);

    s.emit("auth:joined", {
      ok: true,
      socketId: s.id,
      identity: getSocketIdentity(s),
    });
  });

  /* ───────────────── CHAT ───────────────── */

  s.on("chat:join", ({ room = "global" } = {}) => {
    const safeRoom = cleanChatRoom(room);
    s.join(`chat:${safeRoom}`);
    s.emit("chat:joined", { room: safeRoom });
  });

  s.on("chat:leave", ({ room = "global" } = {}) => {
    const safeRoom = cleanChatRoom(room);
    s.leave(`chat:${safeRoom}`);
    s.emit("chat:left", { room: safeRoom });
  });

  s.on("chat:private:join", ({ fromUserId, toUserId } = {}) => {
    const room = buildPrivateChatRoom(fromUserId, toUserId);
    if (!room) {
      s.emit("chat:private:error", {
        ok: false,
        error: "fromUserId y toUserId son requeridos",
      });
      return;
    }

    s.join(room);
    s.emit("chat:private:joined", {
      ok: true,
      room,
      fromUserId: cleanIdentityValue(fromUserId),
      toUserId: cleanIdentityValue(toUserId),
    });

    console.log("[io][chat-private] joined:", {
      socketId: s.id,
      room,
      fromUserId,
      toUserId,
    });
  });

  s.on("chat:private:leave", ({ fromUserId, toUserId, room } = {}) => {
    const finalRoom = room || buildPrivateChatRoom(fromUserId, toUserId) || null;
    if (!finalRoom) return;

    s.leave(finalRoom);
    s.emit("chat:private:left", {
      ok: true,
      room: finalRoom,
    });
  });

  s.on("chat:private:send", (payload = {}, ack) => {
    try {
      const finalRoom =
        payload.room ||
        buildPrivateChatRoom(payload.fromUserId, payload.toUserId);

      if (!finalRoom) {
        if (typeof ack === "function") {
          ack({ ok: false, error: "room inválido" });
        }
        return;
      }

      const message = {
        ...payload,
        room: finalRoom,
        ts: payload?.ts || Date.now(),
      };

      io.to(finalRoom).emit("chat:private:new", message);

      if (typeof ack === "function") {
        ack({ ok: true, room: finalRoom, ts: message.ts });
      }
    } catch (e) {
      console.error("[io][chat-private] error:", e?.message || e);
      if (typeof ack === "function") {
        ack({ ok: false, error: e?.message || "Error enviando mensaje" });
      }
    }
  });

  /* ─────────────── PRESENCIA (ONLINE) ─────────────── */

  s.on("presence:online", ({ userId } = {}) => {
    if (!userId) return;
    s.broadcast.emit("presence:online", { userId });
  });

  s.on("presence:offline", ({ userId } = {}) => {
    if (!userId) return;
    s.broadcast.emit("presence:offline", { userId });
  });

  /* ─────────────── TYPING ─────────────── */

  s.on("chat:typing", ({ room, userId, name } = {}) => {
    if (!room) return;
    s.to(`chat:${room}`).emit("chat:typing", { room, userId, name });
  });

  s.on("chat:stopTyping", ({ room, userId } = {}) => {
    if (!room) return;
    s.to(`chat:${room}`).emit("chat:stopTyping", { room, userId });
  });

  /* ─────────────── SEEN (VISTO) ─────────────── */

  s.on("chat:seen", ({ room, messageId, userId } = {}) => {
    if (!room || !messageId || !userId) return;

    io.to(`chat:${room}`).emit("chat:seen", {
      _id: messageId,
      userId,
      room,
    });
  });

  /* ─────────────── EDIT ─────────────── */

  s.on("chat:edit", ({ room, message } = {}) => {
    if (!room || !message) return;
    io.to(`chat:${room}`).emit("chat:update", message);
  });

  /* ─────────────── DELETE ─────────────── */

  s.on("chat:delete", ({ room, message } = {}) => {
    if (!room || !message) return;
    io.to(`chat:${room}`).emit("chat:delete", message);
  });

  /* ───────────────── ALERTAS ───────────────── */

  const emitEmergencyAlert = (payload = {}, ack) => {
    const now = Date.now();
    const identity = getSocketIdentity(s);
    const roles = normalizeRoles(identity.roles);

    const event = {
      ok: true,
      kind: "emergency",
      ts: now,
      fromSocketId: s.id,
      fromUserId: identity.userId || payload.userId || null,
      fromEmail: identity.email || payload.email || null,
      fromRoles: roles,
      source: payload?.source || "rondas",
      message:
        payload?.message || payload?.body || "Alerta de emergencia activada",
      title: payload?.title || "ALERTA",
      area: payload?.area || payload?.module || "Rondas de Vigilancia",
      priority: payload?.priority || "critical",
      playSound: true,
      ...payload,
    };

    s.emit("alerta:confirmada", {
      ok: true,
      ts: now,
      fromSocketId: s.id,
      deliveredMode: "broadcast-except-visitors",
    });

    s.broadcast
      .except([
        "role:visitante",
        "role:visitantes",
        "role:visita",
        "role:visitor",
        "role:visitors",
      ])
      .emit("alerta:nueva", event);

    console.log("[io][alerta] emitted:", {
      bySocket: s.id,
      byUserId: identity.userId || null,
      byEmail: identity.email || null,
      byRoles: roles,
      title: event.title,
      message: event.message,
    });

    if (typeof ack === "function") {
      ack({ ok: true, sent: true, ts: now });
    }
  };

  const emitPanicAlert = (payload = {}, ack) => {
    const event = normalizePanicEvent(payload);

    s.emit("panic:confirmada", {
      ok: true,
      ts: event.ts,
      fromSocketId: s.id,
      deliveredMode: "broadcast-except-visitors",
      kind: "panic",
    });

    s.broadcast
      .except([
        "role:visitante",
        "role:visitantes",
        "role:visita",
        "role:visitor",
        "role:visitors",
      ])
      .emit("panic:new", event);

    s.broadcast
      .except([
        "role:visitante",
        "role:visitantes",
        "role:visita",
        "role:visitor",
        "role:visitors",
      ])
      .emit("rondasqr:alert", event);

    s.broadcast
      .except([
        "role:visitante",
        "role:visitantes",
        "role:visita",
        "role:visitor",
        "role:visitors",
      ])
      .emit("alerta:nueva", event);

    console.log("[io][panic] emitted:", {
      bySocket: s.id,
      byUserId: event.fromUserId || null,
      byEmail: event.fromEmail || null,
      byRoles: event.fromRoles || [],
      title: event.title,
      message: event.message,
      guardName: event.guardName || "",
      guardEmail: event.guardEmail || "",
      coords: event?.location?.coordsText || event?.gps?.coordsText || "",
    });

    if (typeof ack === "function") {
      ack({
        ok: true,
        sent: true,
        ts: event.ts,
        kind: "panic",
      });
    }
  };

  s.on("alerta:activar", emitEmergencyAlert);
  s.on("alerta:emitir", emitEmergencyAlert);
  s.on("emergency:alert", emitEmergencyAlert);

  s.on("panic:new", emitPanicAlert);
  s.on("rondasqr:alert", emitPanicAlert);
  s.on("panic:emit", emitPanicAlert);
  s.on("panic:trigger", emitPanicAlert);

  s.on("disconnect", (reason) => {
    console.log("[io] bye:", s.id, "reason:", reason);
  });
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
process.on("unhandledRejection", (err) =>
  console.error("[api] UnhandledRejection:", err)
);
process.on("uncaughtException", (err) =>
  console.error("[api] UncaughtException:", err)
);   