// server/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose, { Types as MTypes } from "mongoose";
import nodemailer from "nodemailer";
import path from "node:path";
import fs from "node:fs";

// Auth opcional
import { requireAuth } from "./middleware/auth.js";

// Core de notificaciones
import { makeNotifier } from "./core/notify.js";
import notificationsRoutes from "./core/notifications.routes.js";

// Módulo Rondas QR (el index viejo que ya tenías)
import rondasqr from "../modules/rondasqr/index.js";

// ✅ Evaluaciones (rutas)
import evaluacionesRoutes from "./routes/evaluaciones.routes.js";

// ✅ Incidentes (módulo dedicado)
import incidentesRoutes from "../modules/incidentes/routes/incident.routes.js";

import accesoRoutes from "../modules/controldeacceso/routes/acceso.routes.js";
import uploadRoutes from "../modules/controldeacceso/routes/upload.routes.js";

// Control de visitas
import visitasRoutes from "../modules/visitas/visitas.routes.js";

// ✅ Reports de Rondas
import rondasReportsRoutes from "../modules/rondasqr/routes/rondasqr.reports.routes.js";

// ✅ NUEVO: rutas offline de rondasqr (para /offline/dump)
import rondasOfflineRoutes from "../modules/rondasqr/routes/rondasqr.offline.routes.js";

// Cron de asignaciones (DIARIO)
import { startDailyAssignmentCron } from "./cron/assignments.cron.js";

const app = express();
app.set("trust proxy", 1);

/* ───────────────────── SUPER ADMIN BACKEND ───────────────────── */

const IAM_NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";

// Correos que serán super administradores en TODOS los módulos.
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
  const roles = new Set(
    Array.isArray(rolesArr) ? rolesArr.map((r) => String(r).trim()) : []
  );
  const perms = new Set(
    Array.isArray(permsArr) ? permsArr.map((p) => String(p).trim()) : []
  );

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

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

// Sin /api (ej: http://localhost:4000/uploads/...)
app.use("/uploads", express.static(UPLOADS_ROOT));
// Con /api (ej: http://localhost:4000/api/uploads/...)
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
  console.warn(
    "[iamusers] no se pudo revisar/eliminar username_1:",
    e.message
  );
}

/* ───────────── DEV headers → payload IAM + req.user (bridge) ───────────── */

function iamDevMerge(req, _res, next) {
  const isProd = process.env.NODE_ENV === "production";
  const allowDevHeaders =
    !isProd &&
    String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

  if (!allowDevHeaders) return next();

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
  const applied = applyRootAdmin(
    devEmail,
    p[IAM_NS] || p.roles || [],
    p.permissions || []
  );
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
  if (
    req.headers.authorization &&
    String(process.env.DISABLE_AUTH || "0") !== "1"
  ) {
    return requireAuth(req, res, next);
  }
  return next();
}

/* ─────────────────── MIDDLEWARES GLOBALES ─────────────────── */

app.use(iamDevMerge);
app.use(authBridgeToReqUser);

/* ─────────────────── IAM SIMPLE (SIN registerIAMModule) ─────────────────── */

const iamDb = mongoose.connection;
const UsersCol = iamDb.collection("iamusers");
const RolesCol = iamDb.collection("iamroles");
const PermsCol = iamDb.collection("iampermissions");

// Helper para ObjectId seguro
function toId(id) {
  try {
    return new MTypes.ObjectId(String(id));
  } catch {
    return null;
  }
}

// 🔹 Helper slug para keys de roles/permisos
function slug(str = "") {
  return String(str)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* ---- /me ---- */

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
  };
}

app.get("/api/iam/v1/auth/me", optionalAuth, (req, res) =>
  res.json(pickMe(req))
);
app.get("/api/iam/v1/me", optionalAuth, (req, res) =>
  res.json(pickMe(req))
);

// Alias sin /api
app.get("/iam/v1/auth/me", optionalAuth, (req, res) =>
  res.json(pickMe(req))
);
app.get("/iam/v1/me", optionalAuth, (req, res) =>
  res.json(pickMe(req))
);

/* ---- PERMISOS ---- */

// GET /permissions
app.get("/api/iam/v1/permissions", async (_req, res) => {
  try {
    const items = await PermsCol.find({})
      .sort({ module: 1, key: 1 })
      .toArray();
    res.json({ ok: true, items });
  } catch (e) {
    console.error("[IAM] list permissions error:", e);
    res.status(500).json({ ok: false, error: "Error listando permisos" });
  }
});

// POST /permissions
app.post("/api/iam/v1/permissions", async (req, res) => {
  try {
    const payload = req.body || {};

    let key = payload.key;
    if (!key || typeof key !== "string" || !key.trim()) {
      return res.status(400).json({ ok: false, error: "key requerida" });
    }
    key = key.trim();

    const now = new Date();
    const doc = {
      key,
      name: String(payload.name || payload.label || key),
      module: String(payload.module || payload.modulo || "general"),
      description: String(payload.description || payload.descripcion || ""),
      createdAt: now,
      updatedAt: now,
    };
    const r = await PermsCol.insertOne(doc);
    doc._id = r.insertedId;
    res.json({ ok: true, item: doc });
  } catch (e) {
    console.error("[IAM] create permission error:", e);

    // key duplicada
    if (e?.code === 11000 && e?.keyPattern?.key) {
      return res
        .status(400)
        .json({ ok: false, error: "Ya existe un permiso con esta key" });
    }

    res.status(500).json({ ok: false, error: "Error creando permiso" });
  }
});

// PATCH /permissions/:id
app.patch("/api/iam/v1/permissions/:id", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });

    const payload = req.body || {};
    const $set = {
      updatedAt: new Date(),
    };
    ["key", "name", "module", "description"].forEach((k) => {
      if (payload[k] !== undefined) $set[k] = payload[k];
    });

    await PermsCol.updateOne({ _id }, { $set });
    const item = await PermsCol.findOne({ _id });
    res.json({ ok: true, item });
  } catch (e) {
    console.error("[IAM] update permission error:", e);
    res.status(500).json({ ok: false, error: "Error actualizando permiso" });
  }
});

// DELETE /permissions/:id
app.delete("/api/iam/v1/permissions/:id", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    await PermsCol.deleteOne({ _id });
    res.json({ ok: true });
  } catch (e) {
    console.error("[IAM] delete permission error:", e);
    res.status(500).json({ ok: false, error: "Error eliminando permiso" });
  }
});

/* ---- ROLES ---- */

// GET /roles
app.get("/api/iam/v1/roles", async (_req, res) => {
  try {
    const items = await RolesCol.find({}).sort({ name: 1 }).toArray();
    res.json({ ok: true, items });
  } catch (e) {
    console.error("[IAM] list roles error:", e);
    res.status(500).json({ ok: false, error: "Error listando roles" });
  }
});

// POST /roles
app.post("/api/iam/v1/roles", async (req, res) => {
  try {
    const payload = req.body || {};

    // 🔥 Aceptamos key, o la generamos desde name/label
    let key = payload.key;
    const rawName = payload.name || payload.label || "";

    if (!key || typeof key !== "string" || !key.trim()) {
      if (!rawName) {
        return res.status(400).json({ ok: false, error: "key requerida" });
      }
      key = slug(rawName);
    } else {
      key = key.trim();
    }

    const name = String(rawName || key).trim();

    let permKeys = [];
    if (Array.isArray(payload.permissionKeys)) {
      permKeys = payload.permissionKeys;
    } else if (Array.isArray(payload.permissions)) {
      permKeys = payload.permissions;
    }
    permKeys = permKeys
      .map((v) => String(v || "").trim())
      .filter(Boolean);

    const now = new Date();
    const doc = {
      key,
      code: key, // importante para el índice code_1
      name,
      description: String(payload.description || payload.descripcion || ""),
      permissionKeys: permKeys,
      createdAt: now,
      updatedAt: now,
    };

    const r = await RolesCol.insertOne(doc);
    doc._id = r.insertedId;
    res.json({ ok: true, item: doc });
  } catch (e) {
    console.error("[IAM] create role error:", e);

    // code/key duplicada
    if (e?.code === 11000 && (e?.keyPattern?.code || e?.keyPattern?.key)) {
      return res
        .status(400)
        .json({ ok: false, error: "Ya existe un rol con esta key" });
    }

    res.status(500).json({ ok: false, error: "Error creando rol" });
  }
});

// PATCH /roles/:id
app.patch("/api/iam/v1/roles/:id", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });

    const payload = req.body || {};
    const $set = { updatedAt: new Date() };

    if (payload.key !== undefined) {
      const newKey = String(payload.key || "").trim();
      $set.key = newKey;
      $set.code = newKey; // mantenemos code alineado con key
    }
    if (payload.name !== undefined || payload.label !== undefined) {
      $set.name = String(payload.name || payload.label || "").trim();
    }
    if (payload.description !== undefined || payload.descripcion !== undefined) {
      $set.description = String(
        payload.description || payload.descripcion || ""
      );
    }

    if (payload.permissionKeys) {
      $set.permissionKeys = payload.permissionKeys;
    } else if (payload.permissions) {
      $set.permissionKeys = payload.permissions;
    }

    await RolesCol.updateOne({ _id }, { $set });
    const item = await RolesCol.findOne({ _id });
    res.json({ ok: true, item });
  } catch (e) {
    console.error("[IAM] update role error:", e);
    res.status(500).json({ ok: false, error: "Error actualizando rol" });
  }
});

// DELETE /roles/:id
app.delete("/api/iam/v1/roles/:id", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    await RolesCol.deleteOne({ _id });
    res.json({ ok: true });
  } catch (e) {
    console.error("[IAM] delete role error:", e);
    res.status(500).json({ ok: false, error: "Error eliminando rol" });
  }
});

// GET /roles/:id/permissions
app.get("/api/iam/v1/roles/:id/permissions", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    const role = await RolesCol.findOne({ _id });
    if (!role)
      return res.status(404).json({ ok: false, error: "Rol no encontrado" });
    res.json({
      ok: true,
      permissionKeys: role.permissionKeys || [],
    });
  } catch (e) {
    console.error("[IAM] getRolePerms error:", e);
    res.status(500).json({ ok: false, error: "Error obteniendo permisos" });
  }
});

// PUT /roles/:id/permissions
app.put("/api/iam/v1/roles/:id/permissions", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    const keys = Array.isArray(req.body?.permissionKeys)
      ? req.body.permissionKeys
      : [];
    await RolesCol.updateOne(
      { _id },
      {
        $set: {
          permissionKeys: keys,
          updatedAt: new Date(),
        },
      }
    );
    const role = await RolesCol.findOne({ _id });
    res.json({ ok: true, item: role });
  } catch (e) {
    console.error("[IAM] setRolePerms error:", e);
    res.status(500).json({ ok: false, error: "Error guardando permisos" });
  }
});

/* ---- USUARIOS ---- */

// GET /users
app.get("/api/iam/v1/users", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(q, "i");
      filter.$or = [{ name: rx }, { email: rx }, { dni: rx }];
    }
    const docs = await UsersCol.find(filter)
      .project({
        _id: 1,
        name: 1,
        email: 1,
        dni: 1,
        roles: 1,
        active: 1,
        id_persona: 1,
        correoPersona: 1,
      })
      .sort({ name: 1 })
      .toArray();

    // Adaptar un poco a lo que espera tu UI
    const items = docs.map((u) => ({
      ...u,
      nombreCompleto: u.name,
      correoPersona: u.email || u.correoPersona,
    }));

    res.json({ ok: true, items });
  } catch (e) {
    console.error("[IAM] list users error:", e);
    res.status(500).json({ ok: false, error: "Error listando usuarios" });
  }
});

// lista de guardias (para selects de otros módulos)
async function listGuardsHandler(req, res) {
  try {
    const { q, active } = req.query;
    const filter = {};
    filter.roles = { $in: ["guard", "guardia", "rondasqr.guard"] };

    if (typeof active !== "undefined") {
      const isActive = active === "1" || active === "true";
      filter.active = isActive;
    }

    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const docs = await UsersCol.find(filter, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        active: 1,
        roles: 1,
      },
    }).toArray();

    res.json({ ok: true, items: docs });
  } catch (e) {
    console.error("[GET /iam users/guards] error:", e);
    res.status(500).json({ ok: false, error: "Error al listar guardias" });
  }
}

// lista de guardias con y sin /api
app.get("/api/iam/v1/users/guards", listGuardsHandler);
app.get("/iam/v1/users/guards", listGuardsHandler);

// POST /users
app.post("/api/iam/v1/users", async (req, res) => {
  try {
    const payload = req.body || {};
    const email = String(
      payload.email ||
        payload.correo ||
        payload.correoPersona ||
        ""
    ).trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, error: "email requerido" });
    }

    const name = String(
      payload.nombreCompleto ||
        payload.name ||
        payload.nombre ||
        email.split("@")[0]
    ).trim();

    let roles = [];
    if (Array.isArray(payload.roles)) roles = payload.roles;
    else if (typeof payload.roles === "string") {
      roles = payload.roles
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const active = payload.active !== false;

    const now = new Date();
    const doc = {
      name,
      email,
      dni: payload.dni || null,
      roles,
      active,
      correoPersona: email,
      createdAt: now,
      updatedAt: now,
    };

    const r = await UsersCol.insertOne(doc);
    doc._id = r.insertedId;

    res.json({ ok: true, item: doc });
  } catch (e) {
    console.error("[IAM] create user error:", e);

    // correo duplicado
    if (e?.code === 11000 && e?.keyPattern?.email) {
      return res
        .status(400)
        .json({ ok: false, error: "Ya existe un usuario con este correo" });
    }

    res.status(500).json({ ok: false, error: "Error creando usuario" });
  }
});

// PATCH /users/:id
app.patch("/api/iam/v1/users/:id", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });

    const payload = req.body || {};
    const $set = { updatedAt: new Date() };

    if (payload.nombreCompleto || payload.name) {
      $set.name = payload.nombreCompleto || payload.name;
    }
    if (payload.email || payload.correoPersona || payload.correo) {
      $set.email =
        payload.email || payload.correoPersona || payload.correo;
      $set.correoPersona = $set.email;
    }
    if (payload.dni !== undefined) $set.dni = payload.dni;
    if (payload.active !== undefined) $set.active = !!payload.active;

    if (payload.roles !== undefined) {
      if (Array.isArray(payload.roles)) $set.roles = payload.roles;
      else if (typeof payload.roles === "string") {
        $set.roles = payload.roles
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // Contraseña: la almacenamos en texto plano SOLO para pruebas
    if (payload.password) {
      $set.password = String(payload.password);
    }

    await UsersCol.updateOne({ _id }, { $set });
    const item = await UsersCol.findOne({ _id });
    res.json({ ok: true, item });
  } catch (e) {
    console.error("[IAM] update user error:", e);
    res.status(500).json({ ok: false, error: "Error actualizando usuario" });
  }
});

// enable / disable / "delete"
app.post("/api/iam/v1/users/:id/enable", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    await UsersCol.updateOne(
      { _id },
      { $set: { active: true, updatedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[IAM] enable user error:", e);
    res.status(500).json({ ok: false, error: "Error activando usuario" });
  }
});

app.post("/api/iam/v1/users/:id/disable", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    await UsersCol.updateOne(
      { _id },
      { $set: { active: false, updatedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[IAM] disable user error:", e);
    res.status(500).json({ ok: false, error: "Error desactivando usuario" });
  }
});

// delete = disable
app.post("/api/iam/v1/users/:id/delete", async (req, res) => {
  try {
    const _id = toId(req.params.id);
    if (!_id) return res.status(400).json({ ok: false, error: "id inválido" });
    await UsersCol.updateOne(
      { _id },
      { $set: { active: false, updatedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[IAM] delete user error:", e);
    res.status(500).json({ ok: false, error: "Error eliminando usuario" });
  }
});

/* ─────────── Email verify (opcional) ─────────── */

async function verifyEmailHandler(req, res) {
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
            user: process.env.GMAIL_USER || process.env.MAIL_USER,
            pass: process.env.GMAIL_PASS || process.env.MAIL_PASS,
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
}

// verify email con y sin /api
app.post("/api/iam/v1/users/:id/verify-email", verifyEmailHandler);
app.post("/iam/v1/users/:id/verify-email", verifyEmailHandler);

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
  io.to(`guard-${userId}`).emit("rondasqr:nueva-asignacion", {
    title,
    body,
    meta: { debug: true, ts: Date.now() },
  });
  res.json({
    ok: true,
    sentTo: [`user-${userId}`, `guard-${userId}`],
  });
});

/* ──────────────── RUTA DUMMY PARA CHAT (para evitar 404) ─────────────── */

app.get("/api/chat/messages", (_req, res) => {
  res.json({ ok: true, items: [] });
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

/* ✅ Módulo Control de Acceso */

app.use("/api/acceso", accesoRoutes);
app.use("/acceso", accesoRoutes); // compat sin /api

app.use("/api/acceso/uploads", uploadRoutes);
app.use("/acceso/uploads", uploadRoutes); // compat sin /api

/* ✅ Módulo de VISITAS */

app.use("/api", visitasRoutes);

/* ✅ Módulo de INCIDENTES */

app.use("/api/incidentes", incidentesRoutes);
app.use("/incidentes", incidentesRoutes); // sin /api

/* ✅ Evaluaciones */

// Debug simple SOLO en desarrollo para ver el payload que llega
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
