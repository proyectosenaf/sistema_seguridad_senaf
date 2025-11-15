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
import nodemailer from "nodemailer";
import path from "node:path";
import fs from "node:fs";

// IAM (usuarios/roles/permisos)
import { registerIAMModule } from "../modules/iam/index.js";
// Auth opcional (valida JWT sólo si hay Authorization)
import { requireAuth } from "./middleware/auth.js";

// Core de notificaciones
import { makeNotifier } from "./core/notify.js";
import notificationsRoutes from "./core/notifications.routes.js";

// Módulo Rondas QR (el index viejo que ya tenías)
import rondasqr from "../modules/rondasqr/index.js";

// ✅ Evaluaciones (rutas)
import evaluacionesRoutes from "./routes/evaluaciones.routes.js";

// ✅ Incidentes (AHORA el del módulo *incidentes*, no el de rondas)
import incidentesRoutes from "../modules/incidentes/routes/incident.routes.js";

// ✅ Reports de Rondas (el archivo largo que pegaste)
import rondasReportsRoutes from "../modules/rondasqr/routes/rondasqr.reports.routes.js";

// ✅ NUEVO: rutas offline de rondasqr (para /offline/dump)
import rondasOfflineRoutes from "../modules/rondasqr/routes/rondasqr.offline.routes.js";

// Cron de asignaciones (DIARIO)
import { startDailyAssignmentCron } from "./cron/assignments.cron.js";

const app = express();
app.set("trust proxy", 1);

/* ───────────────────── SUPER ADMIN BACKEND ───────────────────── */

// Namespace IAM para roles
const IAM_NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";

// Correos que serán super administradores en TODOS los módulos.
// Combina ROOT_ADMINS y SUPERADMIN_EMAIL para compatibilidad.
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

/**
 * Dado un email + roles/permisos actuales, fuerza rol admin y permisos globales
 * si el email está en ROOT_ADMINS.
 */
function applyRootAdmin(email, rolesArr = [], permsArr = []) {
  const emailNorm = (email || "").toLowerCase();
  const roles = new Set(Array.isArray(rolesArr) ? rolesArr : []);
  const perms = new Set(Array.isArray(permsArr) ? permsArr : []);

  if (emailNorm && ROOT_ADMINS.includes(emailNorm)) {
    roles.add("admin");
    perms.add("*");
    // permisos clave que ya usas en el frontend
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

// No cache en DEV
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
}

/* ─────────────────────── Estáticos / Uploads ──────────────────── */
/**
 * Unificamos todo en una sola carpeta raíz:
 *   <root>/uploads
 *
 * Desde el frontend las rutas pueden venir como:
 *   /uploads/incidentes/archivo.png
 *   /api/uploads/incidentes/archivo.png
 *
 * Ambas funcionarán porque montamos dos prefijos.
 */
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

// Servir archivos sin /api (ej: http://localhost:4000/uploads/...)
app.use("/uploads", express.static(UPLOADS_ROOT));
// Servir archivos también con /api (ej: http://localhost:4000/api/uploads/...)
app.use("/api/uploads", express.static(UPLOADS_ROOT));

/* ───────────────────────── Health checks ──────────────────────── */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "senaf-api", ts: Date.now() })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ───────────────────── HTTP + Socket.IO bind ──────────────────── */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: origins || true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.set("io", io);
// compat: algunos módulos esperan req.io
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

/* ───────────── DEV headers → payload IAM + req.user (bridge) ───────────── */
function iamDevMerge(req, _res, next) {
  const allow = String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";
  if (!allow) return next();

  const devEmail = req.headers["x-user-email"];
  const devRolesArr = String(req.headers["x-roles"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const devPermsArr = String(req.headers["x-perms"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  req.auth = req.auth || { payload: {} };
  const p = req.auth.payload;

  if (devEmail && !p.email) p.email = devEmail;

  const mergedRoles = new Set([...(p[IAM_NS] || p.roles || []), ...devRolesArr]);
  if (mergedRoles.size) {
    p[IAM_NS] = Array.from(mergedRoles);
    p.roles = Array.from(mergedRoles);
  }

  const mergedPerms = new Set([...(p.permissions || []), ...devPermsArr]);
  if (mergedPerms.size) {
    p.permissions = Array.from(mergedPerms);
  }

  // Aplicar super admin si el correo está en ROOT_ADMINS
  const applied = applyRootAdmin(devEmail, p[IAM_NS] || p.roles || [], p.permissions || []);
  p[IAM_NS] = applied.roles;
  p.roles = applied.roles;
  p.permissions = applied.permissions;

  if (!req.user) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: devEmail || "dev@local",
      [IAM_NS]: applied.roles,
      permissions: applied.permissions,
    };
  }

  next();
}

/* ─────────── Bridge Auth0/JWT → req.user si existe req.auth ─────────── */
function authBridgeToReqUser(req, _res, next) {
  if (!req?.auth?.payload) return next();

  const p = req.auth.payload;
  const email =
    p.email ||
    p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] ||
    null;

  let roles =
    Array.isArray(p[IAM_NS]) ? p[IAM_NS] :
    Array.isArray(p.roles)   ? p.roles   :
    [];

  let permissions = Array.isArray(p.permissions) ? p.permissions : [];

  // Forzar super admin si corresponde
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

/* ────────── Auth opcional: sólo valida si viene Authorization ────────── */
function optionalAuth(req, res, next) {
  if (req.headers.authorization && String(process.env.DISABLE_AUTH || "0") !== "1") {
    return requireAuth(req, res, next);
  }
  return next();
}

/* ─────────────────── MIDDLEWARES antes del 404 ─────────────────── */
app.use(iamDevMerge);
app.use(authBridgeToReqUser);

/* ───────────────────── Stubs simples (UI) ─────────────────────── */
const chatMessagesHandler = (_req, res) => res.json([]);
app.get("/api/chat/messages", chatMessagesHandler);
app.get("/chat/messages", chatMessagesHandler); // alias sin /api

/* ───────────── IAM principal + /me ───────────── */
await registerIAMModule({ app, basePath: "/api/iam/v1" });

function pickMe(req) {
  const p = req?.auth?.payload || {};

  const email =
    p.email ||
    p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] ||
    null;

  let roles =
    Array.isArray(p[IAM_NS]) ? p[IAM_NS] :
    Array.isArray(p.roles)   ? p.roles   :
    [];

  let permissions = Array.isArray(p.permissions) ? p.permissions : [];

  // Aplicar super admin también en la respuesta de /me
  const applied = applyRootAdmin(email, roles, permissions);
  roles = applied.roles;
  permissions = applied.permissions;

  return {
    ok: true,
    user: {
      email,
      name: p.name || null,
      sub: p.sub || null,
    },
    roles,
    permissions,
    _debug:
      process.env.NODE_ENV !== "production"
        ? {
            NS: IAM_NS,
            hasAuthHeader: !!req.headers.authorization,
            fromDevHeaders:
              String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1",
          }
        : undefined,
  };
}

app.get("/api/iam/v1/auth/me", optionalAuth, (req, res) =>
  res.json(pickMe(req))
);
app.get("/api/iam/v1/me", optionalAuth, (req, res) =>
  res.json(pickMe(req))
);

// stub audit rápido
app.get("/api/iam/v1/audit", (_req, res) =>
  res.json({ ok: true, items: [], limit: 100 })
);

/* ─────────── Email verify (opcional) ─────────── */
app.post("/api/iam/v1/users/:id/verify-email", async (req, res) => {
  try {
    const { id } = req.params;
    const email = String(req.body?.email || "").trim();
    if (!id || !email)
      return res
        .status(400)
        .json({ error: "Faltan parámetros (id/email)" });

    const isCustomSmtp = !!process.env.MAIL_HOST;
    const smtpTransport = isCustomSmtp
      ? nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port: Number(process.env.MAIL_PORT || 587),
          secure: String(process.env.MAIL_SECURE || "false") === "true",
          auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
          },
        })
      : nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user:
              process.env.GMAIL_USER || process.env.MAIL_USER,
            pass:
              process.env.GMAIL_PASS || process.env.MAIL_PASS,
          },
        });

    try {
      await smtpTransport.verify();
    } catch (vErr) {
      console.error("[smtp] verify() falló:", vErr?.message || vErr);
      return res.status(500).json({
        error:
          "SMTP no disponible. Revisa credenciales/puerto/host.",
      });
    }

    const fromAddress =
      process.env.MAIL_FROM ||
      `"SENAF Seguridad" <${
        process.env.GMAIL_USER || process.env.MAIL_USER
      }>`;
    const link = process.env.VERIFY_BASE_URL
      ? `${process.env.VERIFY_BASE_URL}?user=${encodeURIComponent(
          id
        )}`
      : `http://localhost:5173/verify?user=${encodeURIComponent(
          id
        )}`;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: "Verificación de correo electrónico",
      html: `
        <div style="font-family:Arial,sans-serif;padding:10px">
          <h2>Verificación de cuenta</h2>
          <p>Hola, por favor verifica tu cuenta haciendo clic en el siguiente enlace:</p>
          <p>
            <a href="${link}" target="_blank"
               style="background:#1d4ed8;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">
               Verificar mi cuenta
            </a>
          </p>
          <p>Si no solicitaste esta verificación, puedes ignorar este correo.</p>
        </div>
      `,
    };

    const info = await smtpTransport.sendMail(mailOptions);
    if (info.rejected && info.rejected.length) {
      return res.status(502).json({
        error: "El servidor SMTP rechazó el correo",
        detail: info.rejected,
      });
    }
    return res.json({
      ok: true,
      message: "Correo de verificación enviado",
    });
  } catch (e) {
    console.error("[verify-email] error:", e);
    return res
      .status(500)
      .json({ error: e?.message || "Error enviando verificación" });
  }
});

/* ─────────────────── Notificaciones globales ──────────────────── */
const notifier = makeNotifier({ io, mailer: null });
app.set("notifier", notifier);
app.use("/api/notifications", notificationsRoutes);
app.use("/notifications", notificationsRoutes); // alias sin /api

// ⏰ Inicia cron de asignaciones (diario)
startDailyAssignmentCron(app);

/* ──────────────── DEBUG: trigger de asignación por URL ─────────────── */
app.get("/api/_debug/ping-assign", (req, res) => {
  const userId = String(req.query.userId || "dev|local");
  const title = String(
    req.query.title || "Nueva ronda asignada (prueba)"
  );
  const body = String(
    req.query.body ||
      "Debes comenzar la ronda de prueba en el punto A."
  );
  io.to(`user-${userId}`).emit("rondasqr:nueva-asignacion", {
    title,
    body,
    meta: { debug: true, ts: Date.now() },
  });
  io
    .to(`guard-${userId}`)
    .emit("rondasqr:nueva-asignacion", {
      title,
      body,
      meta: { debug: true, ts: Date.now() },
    });
  res.json({
    ok: true,
    sentTo: [`user-${userId}`, `guard-${userId}`],
  });
});

/* ───────────────────── Módulo Rondas QR (v1) ──────────────────── */
const pingHandler = (_req, res) =>
  res.json({ ok: true, where: "/rondasqr/v1/ping" });
const pingCheckinHandler = (_req, res) =>
  res.json({ ok: true, where: "/rondasqr/v1/checkin/ping" });

// Con /api (compatibilidad)
app.get("/api/rondasqr/v1/ping", pingHandler);
app.get("/api/rondasqr/v1/checkin/ping", pingCheckinHandler);
app.use("/api/rondasqr/v1", rondasqr);
app.use("/api/rondasqr/v1", rondasReportsRoutes);
app.use("/api/rondasqr/v1", rondasOfflineRoutes);

// Sin /api (para cuando el cliente no usa /api)
app.get("/rondasqr/v1/ping", pingHandler);
app.get("/rondasqr/v1/checkin/ping", pingCheckinHandler);
app.use("/rondasqr/v1", rondasqr);
app.use("/rondasqr/v1", rondasReportsRoutes);
app.use("/rondasqr/v1", rondasOfflineRoutes);

/* ✅ Módulo de INCIDENTES */
app.use("/api/incidentes", incidentesRoutes); // compatibilidad
app.use("/incidentes", incidentesRoutes);     // sin /api

/* ✅ Evaluaciones */
app.use("/evaluaciones", evaluacionesRoutes);
app.use("/api/evaluaciones", evaluacionesRoutes);

/* ────────────────────── Error handler (500) ───────────────────── */
app.use((err, _req, res, _next) => {
  console.error("[api] error:", err?.stack || err?.message || err);
  res
    .status(err.status || 500)
    .json({ ok: false, error: err?.message || "Internal Server Error" });
});

/* ─────────────────────────── 404 final ────────────────────────── */
app.use((_req, res) =>
  res.status(404).json({ ok: false, error: "Not implemented" })
);

/* ─────────────────────── Start / Shutdown ─────────────────────── */
const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(
    `[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`
  );
});

/* ───────────────────────── Socket.IO ──────────────────────────── */
io.on("connection", (s) => {
  console.log("[io] client:", s.id);
  s.emit("hello", { ok: true, ts: Date.now() });

  const joinRooms = (userId) => {
    if (!userId) return;
    s.join(`user-${userId}`);
    s.join(`guard-${userId}`);
    console.log(
      `[io] ${s.id} joined rooms user-${userId} & guard-${userId}`
    );
  };

  // compatibilidad con cliente viejo y nuevo
  s.on("join-room", ({ userId }) => joinRooms(userId));
  s.on("join", ({ userId }) => joinRooms(userId));

  s.on("disconnect", () => console.log("[io] bye:", s.id));
});

/* ────────────────────────── Shutdown ──────────────────────────── */
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
