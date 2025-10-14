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
// ⛔️ No usamos iamEnrich a nivel global
// import { iamEnrich } from "../modules/iam/utils/rbac.util.js";

// JWT opcional (si viene Authorization)
import { requireAuth } from "./middleware/auth.js";

const app = express();
app.set("trust proxy", 1);

// -------- CORS --------
function parseOrigins(str) {
  if (!str) return null;
  return String(str).split(",").map((s) => s.trim()).filter(Boolean);
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

// 🔹 No cache en DEV para que el front siempre vea la última lista
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
}

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
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// -------- MongoDB --------
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error("[db] FALTA MONGODB_URI/MONGO_URI en variables de entorno");
  process.exit(1);
}
await mongoose.connect(mongoUri, { autoIndex: true });
console.log("[db] MongoDB conectado");


// 🔧 Fix índice conflictivo en iamusers: username_1 unique con valores null
try {
  const col = mongoose.connection.collection("iamusers");
  const idx = await col.indexes();
  if (idx.some(i => i.name === "username_1" && i.unique)) {
    await col.dropIndex("username_1");
    console.warn("[iamusers] index username_1 (unique) eliminado (permitirá crear sin username)");
  }
} catch (e) {
  console.warn("[iamusers] no se pudo revisar/eliminar username_1:", e.message);
}


// =====================================================================================
// IAM DEV MERGE: fusiona cabeceras DEV a req.auth.payload (si IAM_ALLOW_DEV_HEADERS=1)
// =====================================================================================
function iamDevMerge(req, _res, next) {
  const allow = process.env.IAM_ALLOW_DEV_HEADERS === "1";
  if (!allow) return next();

  const devEmail = req.headers["x-user-email"];
  const devRoles = String(req.headers["x-roles"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const devPerms = String(req.headers["x-perms"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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

  const roles = Array.isArray(p[NS])
    ? p[NS]
    : Array.isArray(p.roles)
    ? p.roles
    : [];

  const permissions = Array.isArray(p.permissions) ? p.permissions : [];

  return {
    ok: true,
    user: { email, name: p.name || null, sub: p.sub || null },
    roles,
    permissions,
    _debug:
      process.env.NODE_ENV !== "production"
        ? {
            NS,
            hasAuthHeader: !!req.headers.authorization,
            fromDevHeaders: process.env.IAM_ALLOW_DEV_HEADERS === "1",
          }
        : undefined,
  };
}

// -------- Módulos antes del 404 (¡importante!) --------
// Rondas
registerRondasModule({ app, io, basePath: "/api/rondas/v1" });

// En DEV, fusiona headers x-user-email/x-roles/x-perms al payload
app.use(iamDevMerge);

// =======================
// ALIAS de INCIDENCIAS
// =======================
// Intentamos montar el router de incidentes (dos rutas) si existe el archivo.
// Si no existe, montamos un fallback mínimo para evitar 404 en /api/incidentes.
let incidentesMontado = false;
try {
  const maybe = await import("../modules/rondas/incidentes.routes.js").catch(() => ({}));
  if (maybe?.mountIncidentes) {
    maybe.mountIncidentes(app);
    incidentesMontado = true;
    console.log("[incidentes] montado en /api/incidentes y /api/rondas/v1/incidents");
  } else if (maybe?.default) {
    const incidentesRouter = maybe.default;
    app.use("/api/incidentes", incidentesRouter);
    app.use("/api/rondas/v1/incidents", incidentesRouter);
    incidentesMontado = true;
    console.log("[incidentes] router montado (default) en ambas rutas");
  }
} catch (e) {
  console.warn("[incidentes] import falló (se omite):", e?.message || e);
}

if (!incidentesMontado) {
  // Fallback: lista vacía y 201 vacío para no romper UI mientras implementas
  app.get("/api/incidentes", (_req, res) => res.json({ items: [], total: 0 }));
  app.post("/api/incidentes", (_req, res) => res.status(201).json({ ok: true }));
  console.warn("[incidentes] Fallback activo en /api/incidentes (lista vacía)");
}

// ----------------------------------------------
// 🔸 DEV hardening para /api/iam/v1/users (GET/POST)
//     - Debe ir ANTES de registerIAMModule para tomar precedencia.
//     - Usa el mismo modelo/colección que tu app: "iamusers".
// ----------------------------------------------
if (process.env.NODE_ENV !== "production") {
  const COLLECTION = process.env.IAM_USERS_COLLECTION || "iamusers";

  // GET canónico: { items: [...] }
  app.get("/api/iam/v1/users", async (req, res, next) => {
    try {
      // Si existe el modelo, úsalo
      let IamUser = null;
      try {
        ({ default: IamUser } = await import("../modules/iam/models/IamUser.model.js"));
      } catch {}
      if (IamUser?.find) {
        const users = await IamUser.find(
          {},
          { name:1, email:1, roles:1, active:1, perms:1, createdAt:1, updatedAt:1 }
        ).sort({ createdAt: -1 }).lean();
        return res.json({ items: users });
      }
      // Fallback: colección cruda
      const users = await mongoose.connection.collection(COLLECTION)
        .find({}, { projection: { name:1, email:1, roles:1, active:1, perms:1, createdAt:1, updatedAt:1 } })
        .sort({ _id: -1 })
        .toArray();
      res.json({ items: users });
    } catch (e) { next(e); }
  });

  // POST canónico: crea si no existe (email único)
  app.post("/api/iam/v1/users", async (req, res, next) => {
    try {
      const norm = (e) => String(e || "").trim().toLowerCase();
      let { name, email, roles = [], active = true, perms = [] } = req.body || {};
      email = norm(email);
      if (!email) return res.status(400).json({ error: "email requerido" });

      let IamUser = null;
      try {
        ({ default: IamUser } = await import("../modules/iam/models/IamUser.model.js"));
      } catch {}

      if (IamUser?.create) {
        const exists = await IamUser.findOne({ email }).lean();
        if (exists) return res.status(409).json({ error: "ya existe", item: exists });

        const created = await IamUser.create({
          name: (name || "").trim() || null,
          email,
          roles: Array.isArray(roles) ? roles : [],
          perms: Array.isArray(perms) ? perms : [],
          active: !!active,
        });
        return res.status(201).json({ item: created });
      }

      // Fallback con colección cruda
      const col = mongoose.connection.collection(COLLECTION);
      const exists = await col.findOne({ email });
      if (exists) return res.status(409).json({ error: "ya existe", item: exists });

      const now = new Date();
      const ins = await col.insertOne({
        name: (name || "").trim() || null,
        email,
        roles: Array.isArray(roles) ? roles : [],
        perms: Array.isArray(perms) ? perms : [],
        active: !!active,
        createdAt: now,
        updatedAt: now
      });
      const saved = await col.findOne({ _id: ins.insertedId });
      res.status(201).json({ item: saved });
    } catch (e) { next(e); }
  });
}

// IAM (usuarios/roles/permisos)
await registerIAMModule({ app, basePath: "/api/iam/v1" });

// Endpoints /me robustos (funcionan con y sin JWT en DEV)
app.get("/api/iam/v1/auth/me", optionalAuth, (req, res) => res.json(pickMe(req)));
app.get("/api/iam/v1/me", optionalAuth, (req, res) => res.json(pickMe(req)));

// --- Audit (stub): evita 404 y devuelve lista vacía hasta que implementes persistencia ---
app.get("/api/iam/v1/audit", (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  res.json({ ok: true, items: [], limit });
});

// --- Stubs para quitar 404 del UI (opcionales) ---
app.get("/api/notifications/count", (_req, res) => res.json(0));
app.get("/api/chat/messages", (_req, res) => res.json([]));

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
process.on("unhandledRejection", (err) =>
  console.error("[api] UnhandledRejection:", err)
);
process.on("uncaughtException", (err) =>
  console.error("[api] UncaughtException:", err)
);
