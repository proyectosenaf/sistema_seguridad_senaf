// server/modules/iam/index.js
import express from "express";
import mongoose from "mongoose";
import { auth as requireAuth } from "express-oauth2-jwt-bearer";
import IamUser from "./models/IamUser.model.js";
import IamRole from "./models/IamRole.model.js";
import IamPermission from "./models/IamPermission.model.js";
import IamAudit from "./models/IamAudit.model.js";

// ---------- Helpers de Express: capturar errores async ----------
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- JWT on/off según variables ----
const JWT_ENABLED = !!(process.env.AUTH0_AUDIENCE && process.env.AUTH0_ISSUER_BASE_URL);
const authMw = JWT_ENABLED
  ? requireAuth({
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
  return String(v).split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

function getActor(req) {
  const actorId =
    req?.auth?.payload?.sub ||
    req?.iam?.accountId ||
    req?.user?._id ||
    req?.headers["x-user-id"] ||
    null;

  const actorEmail =
    req?.auth?.payload?.email ||
    req?.iam?.email ||
    req?.user?.email ||
    req?.headers["x-user-email"] ||
    null;

  return { actorId, actorEmail };
}

async function logAudit({ action, entity, entityId, before, after, req }) {
  try {
    const { actorId, actorEmail } = getActor(req);
    await IamAudit.create({
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      actorId,
      actorEmail,
      before: before || undefined,
      after: after || undefined,
    });
  } catch (e) {
    console.warn("[IAM:audit] fallo al registrar:", e?.message || e);
  }
}

/**
 * Construye el contexto de IAM.
 * Importante: si el usuario EXISTE en BD, NO se mezclan permisos de headers (x-perms).
 * Los permisos efectivos salen de los roles del usuario en BD.
 * Si NO hay usuario en BD, sí se aceptan roles/permisos de headers para DEV.
 */
async function getUserContext(req) {
  const sub   = req?.auth?.payload?.sub || null;
  const email = req?.auth?.payload?.email || req.headers["x-user-email"] || null;

  const headerRoles = parseHeaderList(req.headers["x-roles"]);
  const headerPerms = parseHeaderList(req.headers["x-perms"]);

  let user =
    (await IamUser.findOne({ externalId: sub }).lean()) ||
    (await IamUser.findOne({ email }).lean());

  // Roles: usa los de BD si existen; de lo contrario, headers (DEV)
  let roleNames = Array.isArray(user?.roles) && user.roles.length
    ? user.roles.slice()
    : headerRoles.slice();

  // Permisos: SOLO toma headers si NO hay usuario en BD
  const permSet = new Set();
  if (!user) headerPerms.forEach(p => permSet.add(p));

  if (roleNames.length) {
    const roleDocs = await IamRole.find({ name: { $in: roleNames } }).lean();
    roleDocs.forEach(r => (r.permissions || []).forEach(p => permSet.add(p)));
  }

  const permissions = Array.from(permSet);
  return {
    me: user || null,
    roleNames,
    permissions,
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
  // Rellenar 'code' cuando falte
  const missing = await IamRole.find({
    $or: [{ code: { $exists: false } }, { code: null }, { code: "" }]
  }).lean();

  for (const r of missing) {
    const code = toCode(r.name || `role_${String(r._id)}`);
    await IamRole.updateOne({ _id: r._id }, { $set: { code } });
  }

  // Asegurar índice único en 'code'
  try {
    const idx = await IamRole.collection.indexes();
    const has = idx.some(i => i.name === "code_1");
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
  // Permisos
  if ((await IamPermission.countDocuments()) === 0) {
    const docs = [];
    let o = 0;
    for (const g of PERMISSIONS_CATALOG) {
      for (const it of g.items) {
        docs.push({ ...it, group: g.group, order: o++ });
      }
    }
    await IamPermission.insertMany(docs);
  }

  // Migrar 'code' en roles existentes y sanear índice
  await migrateRoleCodes();

  // Roles esperados (idempotente por 'code'); mantener 'name' corto (admin, supervisor, etc.)
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
      {
        $setOnInsert: { code: r.code },
        $set: { name: r.name, description: r.description, permissions: r.permissions },
      },
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
    items: items.sort((a, b) => (a.order - b.order) || a.key.localeCompare(b.key)),
  }));
}

// ===== Handlers de usuarios (reutilizables /users y /accounts) =====
async function handleListUsers(req, res) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const users = await IamUser.find().sort({ name: 1 }).lean();
  const allRoles = await IamRole.find().lean();
  const byName = new Map(allRoles.map(r => [r.name, r]));
  const items = users
    .filter(u => !q || `${u.name} ${u.email} ${u.username || ""}`.toLowerCase().includes(q))
    .map(u => ({
      ...u,
      status: u.active === false ? "disabled" : "active",
      roleIds: (u.roles || [])
        .map(n => byName.get(n))
        .filter(Boolean)
        .map(r => ({ _id: r._id, name: r.name })),
    }));
  res.json({ items });
}

async function handleCreateUser(req, res) {
  const { name, email, phone, roles = [], active = true, externalId, username, password, roleIds } = req.body || {};
  let roleNames = roles;
  if ((!Array.isArray(roleNames) || !roleNames.length) && Array.isArray(roleIds) && roleIds.length) {
    const docs = await IamRole.find({ _id: { $in: roleIds } }).lean();
    roleNames = docs.map(d => d.name);
  }
  const exists = await IamUser.findOne({ email });
  if (exists) return res.status(409).json({ message: "Ya existe un usuario con ese correo" });
  const doc = await IamUser.create({
    name, email, phone, roles: roleNames || [], active, externalId,
    ...(username ? { username } : {}), ...(password ? { password } : {}),
  });
  res.status(201).json(doc);
}

async function handleUpdateUser(req, res) {
  const { id } = req.params;
  const { name, phone, roles, roleIds, active, externalId, username, password } = req.body || {};
  let roleNames = roles;
  if ((!Array.isArray(roleNames) || !roleNames.length) && Array.isArray(roleIds) && roleIds.length) {
    const docs = await IamRole.find({ _id: { $in: roleIds } }).lean();
    roleNames = docs.map(d => d.name);
  }
  const set = {
    ...(name!==undefined?{name}:{}) , ...(phone!==undefined?{phone}:{}) ,
    ...(Array.isArray(roleNames)?{roles:roleNames}:{}) , ...(active!==undefined?{active}:{}) ,
    ...(externalId!==undefined?{externalId}:{}) , ...(username!==undefined?{username}:{}) ,
    ...(password!==undefined?{password}:{}),
  };
  const u = await IamUser.findByIdAndUpdate(id, { $set: set }, { new: true });
  res.json(u);
}

async function handleSetRoles(req, res) {
  const { id } = req.params;
  let { roleIds, roles } = req.body || {};
  if ((!Array.isArray(roles) || !roles.length) && Array.isArray(roleIds)) {
    const docs = await IamRole.find({ _id: { $in: roleIds } }).lean();
    roles = docs.map(d => d.name);
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

  router.get("/ping", (_req, res) => res.json({ ok: true, iam: true }));

  // --- Auditoría (últimos N)
  router.get("/audit", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 50)));
    const items = await IamAudit.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ items });
  }));

  // --- Catálogo de permisos
  router.get("/permissions", authMw, requirePerm("iam.roles.manage"), ah(async (_req, res) => {
    const docs = await IamPermission.find().sort({ group: 1, order: 1, key: 1 }).lean();
    res.json({ groups: groupPermissions(docs) });
  }));

  router.post("/permissions", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { key, label, group, order = 0 } = req.body || {};
    if (!key || !label || !group) return res.status(400).json({ message: "key, label y group son requeridos" });
    const exists = await IamPermission.findOne({ key });
    if (exists) return res.status(409).json({ message: "Ya existe un permiso con esa key" });
    const p = await IamPermission.create({ key, label, group, order });
    await logAudit({ action: "perm.create", entity: "permission", entityId: p._id, after: p, req });
    res.status(201).json(p);
  }));

  router.patch("/permissions/:id", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
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
      { $set: { ...(key ? { key } : {}), ...(label ? { label } : {}), ...(group ? { group } : {}), ...(order !== undefined ? { order } : {}) } },
      { new: true }
    );
    await logAudit({ action: "perm.update", entity: "permission", entityId: id, before, after: p, req });
    res.json(p);
  }));

  router.delete("/permissions/:id", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { id } = req.params;
    const force = String(req.query.force || "false") === "true";
    const p = await IamPermission.findById(id).lean();
    if (!p) return res.status(404).json({ message: "No encontrado" });

    const used = await IamRole.countDocuments({ permissions: p.key });
    if (used > 0 && !force) {
      return res.status(409).json({ message: `Permiso en uso por ${used} rol(es)` });
    }
    if (used > 0) {
      await IamRole.updateMany({}, { $pull: { permissions: p.key } });
    }
    await IamPermission.deleteOne({ _id: id });
    await logAudit({ action: "perm.delete", entity: "permission", entityId: id, before: p, req });
    res.json({ ok: true });
  }));

  router.post("/permissions/rename-group", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { from, to } = req.body || {};
    if (!from || !to) return res.status(400).json({ message: "from y to son requeridos" });
    const before = await IamPermission.find({ group: from }).lean();
    const r = await IamPermission.updateMany({ group: from }, { $set: { group: to } });
    await logAudit({ action: "perm.group.rename", entity: "group", entityId: from, before: { group: from }, after: { group: to, modified: r.modifiedCount }, req });
    res.json({ ok: true, modified: r.modifiedCount });
  }));

  router.delete("/permissions/group/:name", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { name } = req.params;
    const force = String(req.query.force || "false") === "true";
    const perms = await IamPermission.find({ group: name }).lean();
    if (!perms.length) return res.json({ ok: true, deleted: 0 });

    const keys = perms.map(p => p.key);
    const used = await IamRole.countDocuments({ permissions: { $in: keys } });
    if (used > 0 && !force) {
      return res.status(409).json({ message: `Grupo con permisos usados en ${used} rol(es)` });
    }
    if (used > 0) {
      await IamRole.updateMany({}, { $pull: { permissions: { $in: keys } } });
    }
    const before = perms;
    const r = await IamPermission.deleteMany({ group: name });
    await logAudit({ action: "perm.group.delete", entity: "group", entityId: name, before, after: { deleted: r.deletedCount }, req });
    res.json({ ok: true, deleted: r.deletedCount });
  }));

  // --- me (y alias /auth/me por compatibilidad)
  const meHandler = ah(async (req, res) => {
    const ctx = await getUserContext(req);
    res.json({ user: ctx.me, roles: ctx.roleNames, permissions: ctx.permissions });
  });
  router.get("/me", authMw, meHandler);
  router.get("/auth/me", authMw, meHandler);

  // --- roles
  router.get("/roles", authMw, requirePerm("iam.roles.manage"), ah(async (_req, res) => {
    const items = await IamRole.find().sort({ name: 1 }).lean();
    res.json({ items });
  }));

  router.post("/roles", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { code: rawCode, name, description, permissions = [] } = req.body || {};
    const code = rawCode ? String(rawCode).trim().toLowerCase() : toCode(name);
    const role = await IamRole.create({ code, name, description, permissions });
    await logAudit({ action: "role.create", entity: "role", entityId: role._id, after: role, req });
    res.status(201).json(role);
  }));

  router.patch("/roles/:id", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { id } = req.params;
    const before = await IamRole.findById(id).lean();
    const { name, description, permissions } = req.body || {};
    const role = await IamRole.findByIdAndUpdate(
      id,
      { $set: { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}), ...(permissions !== undefined ? { permissions } : {}) } },
      { new: true }
    );
    await logAudit({ action: "role.update", entity: "role", entityId: id, before, after: role, req });
    res.json(role);
  }));

  router.put("/roles/:id", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { id } = req.params;
    const before = await IamRole.findById(id).lean();
    const { name, description, permissions = [] } = req.body || {};
    const role = await IamRole.findByIdAndUpdate(id, { $set: { name, description, permissions } }, { new: true });
    await logAudit({ action: "role.update", entity: "role", entityId: id, before, after: role, req });
    res.json(role);
  }));

  router.delete("/roles/:id", authMw, requirePerm("iam.roles.manage"), ah(async (req, res) => {
    const { id } = req.params;
    const role = await IamRole.findById(id).lean();
    if (!role) return res.status(404).json({ message: "Rol no encontrado" });
    if ((role.name || "").toLowerCase() === "admin") {
      return res.status(400).json({ message: "No se puede eliminar el rol admin" });
    }
    const inUsers = await IamUser.countDocuments({ roles: { $in: [role.name] } });
    if (inUsers > 0) return res.status(400).json({ message: "Rol en uso por usuarios" });
    await IamRole.deleteOne({ _id: id });
    await logAudit({ action: "role.delete", entity: "role", entityId: id, before: role, req });
    res.json({ ok: true });
  }));

  // --- USERS (y ACCOUNTS alias v1)
  router.get("/users",    authMw, requirePerm("iam.users.manage"), ah(handleListUsers));
  router.post("/users",   authMw, requirePerm("iam.users.manage"), ah(handleCreateUser));
  router.patch("/users/:id", authMw, requirePerm("iam.users.manage"), ah(handleUpdateUser));
  router.post("/users/:id/roles", authMw, requirePerm("iam.users.manage"), ah(handleSetRoles));
  router.post("/users/:id/disable", authMw, requirePerm("iam.users.manage"), ah(handleDisable));
  router.post("/users/:id/enable",  authMw, requirePerm("iam.users.manage"), ah(handleEnable));

  // Alias que usa tu front (v1)
  router.get("/accounts",    authMw, requirePerm("iam.users.manage"), ah(handleListUsers));
  router.post("/accounts",   authMw, requirePerm("iam.users.manage"), ah(handleCreateUser));
  router.patch("/accounts/:id", authMw, requirePerm("iam.users.manage"), ah(handleUpdateUser));
  router.post("/accounts/:id/roles", authMw, requirePerm("iam.users.manage"), ah(handleSetRoles));
  router.post("/accounts/:id/disable", authMw, requirePerm("iam.users.manage"), ah(handleDisable));
  router.post("/accounts/:id/enable",  authMw, requirePerm("iam.users.manage"), ah(handleEnable));

  return router;
}

// ---- Registro del módulo ----
export async function registerIAMModule({ app, basePath = "/api/iam/v1" }) {
  await ensureSeed();
  const router = buildRouter();

  // Ruta oficial v1
  app.use(basePath, express.json(), router);

  // Alias legacy para compatibilidad
  app.use("/api/iam", express.json(), router);

  // Middleware de error SOLO para rutas IAM (evita tumbar el proceso)
  const errorMw = (err, req, res, _next) => {
    console.error("[IAM] Error:", err?.stack || err);
    const status = Number(err?.status || err?.statusCode || 500);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  };
  app.use(basePath, errorMw);
  app.use("/api/iam", errorMw);

  console.log(`[IAM] módulo listo en ${basePath} (+ alias /api/iam)`);
}
