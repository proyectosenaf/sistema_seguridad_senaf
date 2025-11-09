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

// Módulo Rondas QR
import rondasqr from "../modules/rondasqr/index.js";

// Cron de asignaciones (DIARIO)
import { startDailyAssignmentCron } from "./cron/assignments.cron.js";

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
const RONDAS_UPLOADS_DIR = path.resolve(
  process.cwd(),
  "modules",
  "rondasqr",
  "uploads"
);
if (!fs.existsSync(RONDAS_UPLOADS_DIR))
  fs.mkdirSync(RONDAS_UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(RONDAS_UPLOADS_DIR));

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
  console.warn(
    "[iamusers] no se pudo revisar/eliminar username_1:",
    e.message
  );
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

  // Asegura estructura base
  req.auth = req.auth || { payload: {} };
  const p = req.auth.payload;

  // email simulado
  if (devEmail && !p.email) p.email = devEmail;

  // namespace de los roles
  const NS =
    process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";

  // fusionar roles
  const mergedRoles = new Set([
    ...((p[NS] || p.roles || []) ?? []),
    ...devRolesArr,
  ]);
  if (mergedRoles.size) {
    p[NS] = Array.from(mergedRoles);
    p.roles = Array.from(mergedRoles);
  }

  // fusionar permisos
  const mergedPerms = new Set([
    ...((p.permissions || []) ?? []),
    ...devPermsArr,
  ]);
  if (mergedPerms.size) {
    p.permissions = Array.from(mergedPerms);
  }

  // Exponer req.user también (varios handlers esperan req.user directo)
  if (!req.user) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: devEmail || "dev@local",
      [NS]: Array.from(mergedRoles),
      permissions: Array.from(mergedPerms),
    };
  }

  next();
}

/* ─────────── Bridge Auth0/JWT → req.user si existe req.auth ─────────── */
function authBridgeToReqUser(req, _res, next) {
  if (!req.user && req?.auth?.payload) {
    const p = req.auth.payload;
    const NS =
      process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
    req.user = {
      sub: p.sub || "auth|user",
      email:
        p.email ||
        p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] ||
        null,
      [NS]: Array.isArray(p[NS])
        ? p[NS]
        : Array.isArray(p.roles)
        ? p.roles
        : [],
      permissions: Array.isArray(p.permissions)
        ? p.permissions
        : [],
    };
  }
  next();
}

/* ────────── Auth opcional: sólo valida si viene Authorization ────────── */
function optionalAuth(req, res, next) {
  if (
    req.headers.authorization &&
    String(process.env.DISABLE_AUTH || "0") !== "1"
  ) {
    return requireAuth(req, res, next);
  }
  return next();
}

/* ─────────────────── MIDDLEWARES antes del 404 ─────────────────── */
app.use(iamDevMerge);
app.use(authBridgeToReqUser);

/* ───────────────────── Stubs simples (UI) ─────────────────────── */
app.get("/api/incidentes", (_req, res) =>
  res.json({ items: [], total: 0 })
);
app.post("/api/incidentes", (_req, res) =>
  res.status(201).json({ ok: true })
);
app.get("/api/chat/messages", (_req, res) => res.json([]));

/* ───────────── IAM principal + /me ───────────── */
await registerIAMModule({ app, basePath: "/api/iam/v1" });

function pickMe(req) {
  const p = req?.auth?.payload || {};
  const NS =
    process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";

  const email =
    p.email ||
    p["https://hasura.io/jwt/claims"]?.["x-hasura-user-email"] ||
    null;

  const roles = Array.isArray(p[NS])
    ? p[NS]
    : Array.isArray(p.roles)
    ? p.roles
    : [];

  const permissions = Array.isArray(p.permissions)
    ? p.permissions
    : [];

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
            NS,
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
          secure:
            String(process.env.MAIL_SECURE || "false") === "true",
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
      ? `${process.env.VERIFY_BASE_URL}?user=${encodeURIComponent(id)}`
      : `http://localhost:5173/verify?user=${encodeURIComponent(id)}`;

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

// ⏰ Inicia cron de asignaciones (diario)
startDailyAssignmentCron(app);

/* ──────────────── DEBUG: trigger de asignación por URL ─────────────── */
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

/* ───────────────────── Módulo Rondas QR (v1) ──────────────────── */
app.get("/api/rondasqr/v1/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/rondasqr/v1/ping" })
);
app.get("/api/rondasqr/v1/checkin/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/rondasqr/v1/checkin/ping" })
);
app.use("/api/rondasqr/v1", rondasqr);

/* ──────────────────────── AÑADIDOS: CITAS & VISITAS ─────────────────────── */

// Modelo Cita (usado por AgendaPage.jsx: requiere campo citaAt)
const Cita =
  mongoose.models.Cita ||
  mongoose.model(
    "Cita",
    new mongoose.Schema(
      {
        nombre: { type: String, required: true },
        documento: { type: String, required: true },
        empresa: { type: String, required: true },
        empleado: { type: String, required: true },
        motivo: { type: String, required: true },
        telefono: String,
        correo: String,
        citaAt: { type: Date, required: true }, // clave para tu UI
        estado: {
          type: String,
          enum: ["programada", "finalizada", "cancelada"],
          default: "programada",
        },
      },
      { timestamps: true }
    )
  );

// POST /api/citas  (crea cita)
app.post("/api/citas", async (req, res) => {
  try {
    const {
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
      fecha, // YYYY-MM-DD
      hora,  // HH:mm
    } = req.body;

    if (!nombre || !documento || !empresa || !empleado || !motivo || !fecha || !hora) {
      return res.status(400).json({ ok: false, error: "Faltan campos requeridos" });
    }

    const citaAt = new Date(`${fecha}T${hora}:00`);
    const item = await Cita.create({
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
      citaAt,
    });

    res.status(201).json({ ok: true, item });
  } catch (e) {
    console.error("[citas] POST error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error creando cita" });
  }
});

// GET /api/citas?month=YYYY-MM  (lista todas o por mes)
app.get("/api/citas", async (req, res) => {
  try {
    const { month } = req.query;
    const q = {};
    if (month) {
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      q.citaAt = { $gte: start, $lt: end };
    }
    const items = await Cita.find(q).sort({ citaAt: 1, createdAt: -1 });
    res.json({ ok: true, items });
  } catch (e) {
    console.error("[citas] GET error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error listando citas" });
  }
});

// Modelo Visita (para el modal Registrar Visitante)
const Visita =
  mongoose.models.Visita ||
  mongoose.model(
    "Visita",
    new mongoose.Schema(
      {
        nombre: { type: String, required: true },
        documento: { type: String, required: true },
        empresa: { type: String, required: true },
        empleado: { type: String, required: true },
        motivo: { type: String, required: true },
        telefono: String,
        correo: String,
        // 🔄 Ajuste mínimo: usamos los valores del modelo/pantalla ("Dentro"/"Finalizada"/"Cancelada")
        estado: {
          type: String,
          enum: ["Dentro", "Finalizada", "Cancelada", "Programada"],
          default: "Dentro", // ✅ por defecto ACTIVA (Dentro)
        },
        fechaEntrada: { type: Date, default: () => new Date() },
        fechaSalida: { type: Date, default: null },
      },
      { timestamps: true }
    )
  );

// POST /api/visitas  (registrar visitante entrando → Dentro)
app.post("/api/visitas", async (req, res) => {
  try {
    const {
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
    } = req.body;

    if (!nombre || !documento || !empresa || !empleado || !motivo) {
      return res.status(400).json({ ok: false, error: "Faltan campos requeridos" });
    }

    const item = await Visita.create({
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
      estado: "Dentro",          // ✅ ACTIVA
      fechaEntrada: new Date(),  // ✅ ahora
      fechaSalida: null,         // ✅ sin salida
    });

    res.status(201).json({ ok: true, item });
  } catch (e) {
    console.error("[visitas] POST error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error creando visita" });
  }
});

// GET /api/visitas  (lista y normaliza estado para docs viejos sin estado)
app.get("/api/visitas", async (_req, res) => {
  try {
    const raw = await Visita.find().sort({ createdAt: -1 }).lean();

    const items = raw.map(v => {
      const estado = v.estado
        ? v.estado
        : (v.fechaSalida ? "Finalizada" : "Dentro"); // ✅ normalización consistente
      return { ...v, estado };
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error("[visitas] GET error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error listando visitas" });
  }
});

// PUT /api/visitas/:id/finalizar  → pasa a Finalizada y marca fechaSalida
app.put("/api/visitas/:id/finalizar", async (req, res) => {
  try {
    const { id } = req.params;
    const v = await Visita.findByIdAndUpdate(
      id,
      { estado: "Finalizada", fechaSalida: new Date() }, // ✅ finaliza
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "No encontrada" });
    res.json({ ok: true, item: v });
  } catch (e) {
    console.error("[visitas] FINALIZAR error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error finalizando visita" });
  }
});

// PATCH /api/visitas/:id/cerrar  → alias compatible (evita "Not implemented")
app.patch("/api/visitas/:id/cerrar", async (req, res) => {
  try {
    const { id } = req.params;
    const v = await Visita.findByIdAndUpdate(
      id,
      { estado: "Finalizada", fechaSalida: new Date() },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "No encontrada" });
    res.json({ ok: true, item: v });
  } catch (e) {
    console.error("[visitas] CERRAR (PATCH) error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error cerrando visita" });
  }
});

// POST /api/visitas/:id/cerrar  → alias extra (algunos UIs usan POST)
app.post("/api/visitas/:id/cerrar", async (req, res) => {
  try {
    const { id } = req.params;
    const v = await Visita.findByIdAndUpdate(
      id,
      { estado: "Finalizada", fechaSalida: new Date() },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "No encontrada" });
    res.json({ ok: true, item: v });
  } catch (e) {
    console.error("[visitas] CERRAR (POST) error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error cerrando visita" });
  }
});

// Compatibilidad adicional por si algún componente llama /api/visitas/visitas/:id/cerrar
app.patch("/api/visitas/visitas/:id/cerrar", async (req, res) => {
  try {
    const { id } = req.params;
    const v = await Visita.findByIdAndUpdate(
      id,
      { estado: "Finalizada", fechaSalida: new Date() },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "No encontrada" });
    res.json({ ok: true, item: v });
  } catch (e) {
    console.error("[visitas] CERRAR (compat) error:", e);
    res.status(500).json({ ok: false, error: e.message || "Error cerrando visita" });
  }
});

/* ───────────── MÉTRICAS DIARIAS (reinicia cada día) ───────────── */

// GET /api/visitas/metrics/daily?date=YYYY-MM-DD
app.get("/api/visitas/metrics/daily", async (req, res) => {
  try {
    const dateStr = String(
      req.query.date || new Date().toISOString().slice(0, 10)
    ); // YYYY-MM-DD
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const match = { fechaEntrada: { $gte: start, $lt: end } };

    const [row] = await Visita.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          activos: {
            $sum: { $cond: [{ $eq: ["$estado", "Dentro"] }, 1, 0] },
          },
          finalizadas: {
            $sum: { $cond: [{ $eq: ["$estado", "Finalizada"] }, 1, 0] },
          },
          canceladas: {
            $sum: { $cond: [{ $eq: ["$estado", "Cancelada"] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      ok: true,
      date: dateStr,
      total: row?.total || 0,
      activos: row?.activos || 0,
      finalizadas: row?.finalizadas || 0,
      canceladas: row?.canceladas || 0,
    });
  } catch (e) {
    console.error("[visitas] metrics daily error:", e);
    res
      .status(500)
      .json({ ok: false, error: e.message || "Error metrics visitas" });
  }
});

// GET /api/citas/metrics/daily?date=YYYY-MM-DD
app.get("/api/citas/metrics/daily", async (req, res) => {
  try {
    const dateStr = String(
      req.query.date || new Date().toISOString().slice(0, 10)
    );
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const match = { citaAt: { $gte: start, $lt: end } };

    const [row] = await Cita.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          programadas: {
            $sum: { $cond: [{ $eq: ["$estado", "programada"] }, 1, 0] },
          },
          finalizadas: {
            $sum: { $cond: [{ $eq: ["$estado", "finalizada"] }, 1, 0] },
          },
          canceladas: {
            $sum: { $cond: [{ $eq: ["$estado", "cancelada"] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      ok: true,
      date: dateStr,
      total: row?.total || 0,
      programadas: row?.programadas || 0,
      finalizadas: row?.finalizadas || 0,
      canceladas: row?.canceladas || 0,
    });
  } catch (e) {
    console.error("[citas] metrics daily error:", e);
    res
      .status(500)
      .json({ ok: false, error: e.message || "Error metrics citas" });
  }
});

/* ────────────────────── Error handler (500) ───────────────────── */
app.use((err, _req, res, _next) => {
  console.error("[api] error:", err?.stack || err?.message || err);
  res
    .status(err.status || 500)
    .json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
});

/* ─────────────────────────── 404 final ────────────────────────── */
app.use((_req, res) =>
  res.status(404).json({ ok: false, error: "Not implemented" })
);

/* ─────────────────────── Start / Shutdown ─────────────────────── */
const PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(
    `[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`
  );
});

/* ───────────────────────── Socket.IO ──────────────────────────── */
io.on("connection", (s) => {
  console.log("[io] client:", s.id);
  s.emit("hello", { ok: true, ts: Date.now() });
  s.on("join-room", ({ userId }) => {
    if (userId) {
      s.join(`user-${userId}`);
      s.join(`guard-${userId}`); // compat con módulo rondas
      console.log(
        `[io] ${s.id} joined rooms user-${userId} & guard-${userId}`
      );
    }
  });
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