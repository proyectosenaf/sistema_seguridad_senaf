// server/modules/iam/index.js
import express from "express";
import mongoose from "mongoose";
import { auth as requireJwt } from "express-oauth2-jwt-bearer";
import IamUser from "./models/IamUser.model.js";
import IamRole from "./models/IamRole.model.js";
import IamPermission from "./models/IamPermission.model.js";
import IamAudit from "./models/IamAudit.model.js";
import authRoutes from "./routes/auth.routes.js";
import { iamEnrich } from "./utils/rbac.util.js";

// ---------- Helpers de Express: capturar errores async ----------
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- DEV bypass de permisos ----
const DEV_ALLOW_ALL = process.env.IAM_DEV_ALLOW_ALL === "1" || process.env.NODE_ENV !== "production";
const devOr = (mw) => (req, res, next) => (DEV_ALLOW_ALL ? next() : mw(req, res, next));

// ---- JWT on/off según variables ----
const JWT_ENABLED = !!(process.env.AUTH0_AUDIENCE && process.env.AUTH0_ISSUER_BASE_URL);
const authMw = JWT_ENABLED
  ? requireJwt({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
      tokenSigningAlg: "RS256",
    })
  : (_req, _res, next) => next();

if (!JWT_ENABLED) {
  console.log(
    "[IAM] JWT deshabilitado: faltan AUTH0_ISSUER_BASE_URL/AUTH0_AUDIENCE. " +
      "Se usará modo DEV por headers (x-user-id, x-user-email, x-roles, x-perms)."
  );
}

// ---- utils ----
function parseHeaderList(v) {
  if (!v) return [];
  return String(v).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

async function getUserFromUsuarios(email) {
  if (!email) return null;
  try {
    const raw = await mongoose.connection.collection("usuarios").findOne({ email });
    if (!raw) return null;
    return {
      _id: raw._id,
      externalId: raw.externalId,
      email: raw.email,
      name: raw.name,
      roles: Array.isArray(raw.roles) ? raw.roles : [],
      perms: Array.isArray(raw.perms) ? raw.perms : [],
      active: raw.active !== false,
      _source: "usuarios",
    };
  } catch {
    return null;
  }
}

async function getUserContext(req) {
  const sub = req?.auth?.payload?.sub || null;
  const email = req?.auth?.payload?.email || req.headers["x-user-email"] || null;

  const headerRoles = parseHeaderList(req.headers["x-roles"]);
  const headerPerms = parseHeaderList(req.headers["x-perms"]);

  let user =
    (sub && (await IamUser.findOne({ externalId: sub }).lean())) ||
    (email && (await IamUser.findOne({ email }).lean())) ||
    (await getUserFromUsuarios(email));

  // Roles: BD primero; si no hay, usa headers DEV
  let roleNames =
    Array.isArray(user?.roles) && user.roles.length ? user.roles.slice() : headerRoles.slice();

  // Permisos: incluye los directos del doc y, si no hay usuario, también headers
  const permSet = new Set(Array.isArray(user?.perms) ? user.perms : []);
  if (!user) headerPerms.forEach((p) => permSet.add(p));

  // Permisos derivados de roles
  if (roleNames.length) {
    const roleDocs = await IamRole.find({ name: { $in: roleNames } }).lean();
    roleDocs.forEach((r) => (r.permissions || []).forEach((p) => permSet.add(p)));
  }

  return {
    me: user || null,
    roleNames,
    permissions: Array.from(permSet),
    has: (perm) => permSet.has("*") || permSet.has(perm),
  };
}

function requirePerm(perm) {
  return ah(async (req, res, next) => {
    const ctx = await getUserContext(req);
    if (!ctx.has(perm)) return res.status(403).json({ message: "Permiso denegado" });
    req.iam = ctx;
    next();
  });
}

// ---- Catálogo base para seed ----
const PERMISSIONS_CATALOG = [
  { group: "IAM", items: [
    { key: "iam.users.manage", label: "Gestionar usuarios" },
    { key: "iam.roles.manage", label: "Gestionar roles" },
  ] },
  { group: "Rondas de Vigilancia", items: [
    { key: "rondas.read",  label: "Ver rondas" },
    { key: "rondas.write", label: "Crear/Editar rondas" },
  ] },
  { group: "Gestión de Incidentes", items: [
    { key: "incidentes.read",  label: "Ver incidentes" },
    { key: "incidentes.write", label: "Crear/Editar incidentes" },
  ] },
  { group: "Control de Acceso", items: [
    { key: "accesos.read",  label: "Ver accesos" },
    { key: "accesos.write", label: "Registrar/Editar accesos" },
  ] },
  { group: "Control de Visitas", items: [
    { key: "visitas.read",  label: "Ver visitas" },
    { key: "visitas.write", label: "Registrar/Editar visitas" },
  ] },
  { group: "Bitácora Digital", items: [
    { key: "bitacora.read",  label: "Ver bitácora" },
    { key: "bitacora.write", label: "Registrar en bitácora" },
  ] },
  { group: "Supervisión", items: [
    { key: "supervision.read",  label: "Ver supervisión" },
    { key: "supervision.write", label: "Registrar/Editar supervisión" },
  ] },
  { group: "Evaluación", items: [{ key: "evaluacion.read", label: "Ver evaluaciones" }] },
  { group: "Reportes",   items: [{ key: "reportes.read",   label: "Ver reportes" }] },
];

// ---- helpers de seed/migración ----
function toCode(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function migrateRoleCodes() {
  const missing = await IamRole.find({
    $or: [{ code: { $exists: false } }, { code: null }, { code: "" }],
  }).lean();

  for (const r of missing) {
    const code = toCode(r.name || `role_${String(r._id)}`);
    await IamRole.updateOne({ _id: r._id }, { $set: { code } });
  }

  try {
    const idx = await IamRole.collection.indexes();
    const has = idx.some((i) => i.name === "code_1");
    if (has) {
      try { await IamRole.collection.dropIndex("code_1"); } catch {}
    }
    await IamRole.collection.createIndex({ code: 1 }, { unique: true });
  } catch (e) {
    console.warn("[IAM] (roles) no se pudo recrear índice code_1:", e?.message || e);
  }
}

// ---- seed permisos + roles (UPSERT) ----
async function ensureSeed() {
  if ((await IamPermission.countDocuments()) === 0) {
    const docs = [];
    let o = 0;
    for (const g of PERMISSIONS_CATALOG) {
      for (const it of g.items) docs.push({ ...it, group: g.group, order: o++ });
    }
    await IamPermission.insertMany(docs);
  }

  await migrateRoleCodes();

  const ALL = "*";
  const perms = {
    IAM_MANAGE: "iam.users.manage",
    IAM_ROLES: "iam.roles.manage",
    RONDAS: ["rondas.read", "rondas.write"],
    INCIDENTES: ["incidentes.read", "incidentes.write"],
    ACCESOS: ["accesos.read", "accesos.write"],
    VISITAS: ["visitas.read", "visitas.write"],
    REPORTES: ["reportes.read"],
    BITACORA: ["bitacora.read", "bitacora.write"],
    SUPERVISION: ["supervision.read", "supervision.write"],
    EVAL: ["evaluacion.read"],
  };

  const SHOULD_HAVE = [
    { code: "admin",      name: "admin",      description: "Superusuario del sistema", permissions: [ALL, perms.IAM_MANAGE, perms.IAM_ROLES].flat() },
    { code: "supervisor", name: "supervisor", description: "Supervisa y reporta",       permissions: [...perms.RONDAS, ...perms.SUPERVISION, ...perms.INCIDENTES, ...perms.ACCESOS, "reportes.read"] },
    { code: "guardia",    name: "guardia",    description: "Registra rondas/incidentes", permissions: ["rondas.read","rondas.write","incidentes.read","incidentes.write"] },
    { code: "recepcion",  name: "recepcion",  description: "Accesos y visitas",          permissions: [...perms.ACCESOS, ...perms.VISITAS] },
    { code: "analista",   name: "analista",   description: "Solo reportes",              permissions: [...perms.REPORTES, "rondas.read","incidentes.read","visitas.read"] },
    { code: "ti",         name: "ti",         description: "Soporte/Config",             permissions: ["bitacora.read","bitacora.write", perms.IAM_ROLES] },
  ];

  for (const r of SHOULD_HAVE) {
    await IamRole.updateOne(
      { code: r.code },
      { $setOnInsert: { code: r.code }, $set: { name: r.name, description: r.description, permissions: r.permissions } },
      { upsert: true }
    );
  }
}

// ---------- Helpers ----------
function groupPermissions(docs) {
  const map = new Map();
  for (const d of docs) {
    if (!map.has(d.group)) map.set(d.group, []);
    map.get(d.group).push({ _id: d._id, key: d.key, label: d.label, order: d.order });
  }
  return Array.from(map, ([group, items]) => ({
    group,
    items: items.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)),
  }));
}

// ===== Handlers de usuarios (reutilizables /users y /accounts) =====
async function handleListUsers(req, res) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const users = await IamUser.find().sort({ name: 1 }).lean();
  const allRoles = await IamRole.find().lean();
  const byName = new Map(allRoles.map((r) => [r.name, r]));
  const items = users
    .filter((u) =>
      !q || `${u.name} ${u.email} ${u.username || ""}`.toLowerCase().includes(q)
    )
    .map((u) => ({
      ...u,
      status: u.active === false ? "disabled" : "active",
      roleIds: (u.roles || [])
        .map((n) => byName.get(n))
        .filter(Boolean)
        .map((r) => ({ _id: r._id, name: r.name })),
    }));
  res.json({ items });
}

async function handleCreateUser(req, res) {
  const {
    name,
    email,
    phone,
    roles = [],
    active = true,
    externalId,
    username,
    password,
    roleIds,
  } = req.body || {};
  let roleNames = roles;
  if ((!Array.isArray(roleNames) || !roleNames.length) && Array.isArray(roleIds) && roleIds.length) {
    const docs = await IamRole.find({ _id: { $in: roleIds } }).lean();
    roleNames = docs.map((d) => d.name);
  }
  const exists = await IamUser.findOne({ email });
  if (exists) return res.status(409).json({ message: "Ya existe un usuario con ese correo" });
  const doc = await IamUser.create({
    name,
    email,
    phone,
    roles: roleNames || [],
    active,
    externalId,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  });
  res.status(201).json(doc);
}

async function handleUpdateUser(req, res) {
  const { id } = req.params;
  const { name, phone, roles, roleIds, active, externalId, username, password } = req.body || {};
  let roleNames = roles;
  if ((!Array.isArray(roleNames) || !roleNames.length) && Array.isArray(roleIds) && roleIds.length) {
    const docs = await IamRole.find({ _id: { $in: roleIds } }).lean();
    roleNames = docs.map((d) => d.name);
  }
  const set = {
    ...(name !== undefined ? { name } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(Array.isArray(roleNames) ? { roles: roleNames } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(externalId !== undefined ? { externalId } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(password !== undefined ? { password } : {}),
  };
  const u = await IamUser.findByIdAndUpdate(id, { $set: set }, { new: true });
  res.json(u);
}

async function handleSetRoles(req, res) {
  const { id } = req.params;
  let { roleIds, roles } = req.body || {};
  if ((!Array.isArray(roles) || !roles.length) && Array.isArray(roleIds)) {
    const docs = await IamRole.find({ _id: { $in: roleIds } }).lean();
    roles = docs.map((d) => d.name);
  }
  const u = await IamUser.findByIdAndUpdate(id, { $set: { roles: roles || [] } }, { new: true });
  res.json(u);
}

async function handleDisable(req, res) {
  const { id } = req.params;
  const u = await IamUser.findByIdAndUpdate(id, { $set: { active: false } }, { new: true });
  res.json(u);
}

async function handleEnable(req, res) {
  const { id } = req.params;
  const u = await IamUser.findByIdAndUpdate(id, { $set: { active: true } }, { new: true });
  res.json(u);
}

// ---------- Rutas ----------
function buildRouter() {
  const router = express.Router();

  // Enriquecimiento antes de todo (lee headers DEV y BD "usuarios")
  router.use(iamEnrich);

  router.get("/ping", (_req, res) => res.json({ ok: true, iam: true }));

  // --- me (y alias /auth/me)
  const meHandler = ah(async (req, res) => {
    const ctx = await getUserContext(req);
    res.json({ user: ctx.me, roles: ctx.roleNames, permissions: ctx.permissions });
  });
  router.get("/me", authMw, meHandler);
  router.get("/auth/me", authMw, meHandler);

  // --- Auditoría (últimos N)
  router.get(
    "/audit",
    authMw,
    devOr(requirePerm("iam.roles.manage")),
    ah(async (_req, res) => {
      const limit = Math.min(500, Math.max(1, Number(_req.query.limit || 50)));
      const items = await IamAudit.find().sort({ createdAt: -1 }).limit(limit).lean();
      res.json({ items });
    })
  );

  // --- Catálogo de permisos
  router.get(
    "/permissions",
    authMw,
    devOr(requirePerm("iam.roles.manage")),
    ah(async (_req, res) => {
      const docs = await IamPermission.find().sort({ group: 1, order: 1, key: 1 }).lean();
      res.json({ groups: groupPermissions(docs) });
    })
  );

  router.post(
    "/permissions",
    authMw,
    devOr(requirePerm("iam.roles.manage")),
    ah(async (req, res) => {
      const { key, label, group, order = 0 } = req.body || {};
      if (!key || !label || !group)
        return res.status(400).json({ message: "key, label y group son requeridos" });
      const exists = await IamPermission.findOne({ key });
      if (exists) return res.status(409).json({ message: "Ya existe un permiso con esa key" });
      const p = await IamPermission.create({ key, label, group, order });
      res.status(201).json(p);
    })
  );

  router.patch(
    "/permissions/:id",
    authMw,
    devOr(requirePerm("iam.roles.manage")),
    ah(async (req, res) => {
      const { id } = req.params;
      const before = await IamPermission.findById(id).lean();
      if (!before) return res.status(404).json({ message: "No encontrado" });

      const { key, label, group, order } = req.body || {};
      if (key && key !== before.key) {
        await IamRole.updateMany(
          { permissions: before.key },
          { $addToSet: { permissions: key }, $pull: { permissions: before.key } }
        );
      }

      const p = await IamPermission.findByIdAndUpdate(
        id,
        {
          $set: {
            ...(key ? { key } : {}),
            ...(label ? { label } : {}),
            ...(group ? { group } : {}),
            ...(order !== undefined ? { order } : {}),
          },
        },
        { new: true }
      );
      res.json(p);
    })
  );

  router.delete(
    "/permissions/:id",
    authMw,
    devOr(requirePerm("iam.roles.manage")),
    ah(async (req, res) => {
      const { id } = req.params;
      const p = await IamPermission.findById(id).lean();
      if (!p) return res.status(404).json({ message: "No encontrado" });

      const used = await IamRole.countDocuments({ permissions: p.key });
      if (used > 0) {
        await IamRole.updateMany({}, { $pull: { permissions: p.key } });
      }
      await IamPermission.deleteOne({ _id: id });
      res.json({ ok: true });
    })
  );

  // --- roles
  router.get("/roles", authMw, devOr(requirePerm("iam.roles.manage")), ah(async (_req, res) => {
    const items = await IamRole.find().sort({ name: 1 }).lean();
    res.json({ items });
  }));

  router.post("/roles", authMw, devOr(requirePerm("iam.roles.manage")), ah(async (req, res) => {
    const { code: rawCode, name, description, permissions = [] } = req.body || {};
    const code = rawCode ? String(rawCode).trim().toLowerCase() : toCode(name);
    const role = await IamRole.create({ code, name, description, permissions });
    res.status(201).json(role);
  }));

  router.patch("/roles/:id", authMw, devOr(requirePerm("iam.roles.manage")), ah(async (req, res) => {
    const { id } = req.params;
    const { name, description, permissions } = req.body || {};
    const role = await IamRole.findByIdAndUpdate(
      id,
      { $set: { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}), ...(permissions !== undefined ? { permissions } : {}) } },
      { new: true }
    );
    res.json(role);
  }));

  router.delete("/roles/:id", authMw, devOr(requirePerm("iam.roles.manage")), ah(async (req, res) => {
    const { id } = req.params;
    const role = await IamRole.findById(id).lean();
    if (!role) return res.status(404).json({ message: "Rol no encontrado" });
    if ((role.name || "").toLowerCase() === "admin") {
      return res.status(400).json({ message: "No se puede eliminar el rol admin" });
    }
    const inUsers = await IamUser.countDocuments({ roles: { $in: [role.name] } });
    if (inUsers > 0) return res.status(400).json({ message: "Rol en uso por usuarios" });
    await IamRole.deleteOne({ _id: id });
    res.json({ ok: true });
  }));

  // --- USERS (y ACCOUNTS alias v1)
  router.get("/users", authMw, devOr(requirePerm("iam.users.manage")), ah(handleListUsers));
  router.post("/users", authMw, devOr(requirePerm("iam.users.manage")), ah(handleCreateUser));
  router.patch("/users/:id", authMw, devOr(requirePerm("iam.users.manage")), ah(handleUpdateUser));
  router.post("/users/:id/roles", authMw, devOr(requirePerm("iam.users.manage")), ah(handleSetRoles));
  router.post("/users/:id/disable", authMw, devOr(requirePerm("iam.users.manage")), ah(handleDisable));
  router.post("/users/:id/enable", authMw, devOr(requirePerm("iam.users.manage")), ah(handleEnable));

  // Alias v1
  router.get("/accounts", authMw, devOr(requirePerm("iam.users.manage")), ah(handleListUsers));
  router.post("/accounts", authMw, devOr(requirePerm("iam.users.manage")), ah(handleCreateUser));
  router.patch("/accounts/:id", authMw, devOr(requirePerm("iam.users.manage")), ah(handleUpdateUser));
  router.post("/accounts/:id/roles", authMw, devOr(requirePerm("iam.users.manage")), ah(handleSetRoles));
  router.post("/accounts/:id/disable", authMw, devOr(requirePerm("iam.users.manage")), ah(handleDisable));
  router.post("/accounts/:id/enable", authMw, devOr(requirePerm("iam.users.manage")), ah(handleEnable));

  // Rutas auth simples (compatibilidad)
  router.use("/auth", authRoutes);

  return router;
}

// ---- Registro del módulo ----
export async function registerIAMModule({ app, basePath = "/api/iam/v1" }) {
  await ensureSeed();

  // Para que iamEnrich pueda obtener la conexión en req.app.get("mongoose")
  app.set("mongoose", mongoose);

  const router = buildRouter();

  // v1 y alias legacy
  app.use(basePath, express.json(), router);
  app.use("/api/iam", express.json(), router);

  // Manejo de errores scoped a IAM
  const errorMw = (err, _req, res, _next) => {
    console.error("[IAM] Error:", err?.stack || err);
    const status = Number(err?.status || err?.statusCode || 500);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  };
  app.use(basePath, errorMw);
  app.use("/api/iam", errorMw);

  console.log(`[IAM] módulo listo en ${basePath} (+ alias /api/iam) — DEV_ALLOW_ALL=${DEV_ALLOW_ALL ? "ON" : "OFF"}`);
}
