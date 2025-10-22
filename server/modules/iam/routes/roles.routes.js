// modules/iam/routes/roles.routes.js
import { Router } from "express";
import IamRole from "../models/IamRole.model.js";
import IamPermission from "../models/IamPermission.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
// ⬇️ Ajusta la ruta si tu helper está en otro archivo:
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

const normCode = (s = "") =>
  String(s).trim().toLowerCase().replace(/\s+/g, "_");

// ------------------------------------------------------------------
// LISTAR ROLES
// ------------------------------------------------------------------
r.get("/", devOr(requirePerm("iam.roles.manage")), async (_req, res) => {
  const items = await IamRole.find().sort({ name: 1 }).lean();
  res.json({ items });
});

// ------------------------------------------------------------------
// CREAR ROL
// body: { code?, name, description?, permissions? (array de KEYS) }
// ------------------------------------------------------------------
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { code: rawCode, name, description, permissions = [] } = req.body || {};
  if (!name) return res.status(400).json({ message: "name es requerido" });

  const code = normCode(rawCode || name);

  // Validar duplicados por code
  const dup = await IamRole.exists({ code });
  if (dup) return res.status(409).json({ message: "code ya existe" });

  // Validar que todas las keys de permisos existan
  const cleanPerms = [...new Set(permissions.map((k) => String(k).trim()))].filter(Boolean);
  if (cleanPerms.length) {
    const cnt = await IamPermission.countDocuments({ key: { $in: cleanPerms } });
    if (cnt !== cleanPerms.length) {
      return res.status(400).json({ message: "Uno o más permisos (keys) no existen" });
    }
  }

  const doc = await IamRole.create({ code, name: String(name).trim(), description, permissions: cleanPerms });

  // 🔎 AUDIT: creación de rol
  await writeAudit(req, {
    action: "create",
    entity: "role",
    entityId: doc._id.toString(),
    before: null,
    after: { code: doc.code, name: doc.name, description: doc.description ?? null, permissions: doc.permissions || [] },
  });

  res.status(201).json(doc);
});

// ------------------------------------------------------------------
// ACTUALIZAR ROL (name/code/description)
// ------------------------------------------------------------------
r.patch("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { id } = req.params;
  const { code, name, description } = req.body || {};

  const update = {};
  if (typeof name !== "undefined") update.name = String(name).trim();
  if (typeof description !== "undefined") update.description = description;
  if (typeof code !== "undefined") update.code = normCode(code);

  // Si viene code nuevo, verificar duplicado
  if (update.code) {
    const exists = await IamRole.exists({ _id: { $ne: id }, code: update.code });
    if (exists) return res.status(409).json({ message: "code ya existe" });
  }

  // 🔎 AUDIT: capturar estado previo
  const before = await IamRole.findById(id).lean();

  const doc = await IamRole.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!doc) return res.status(404).json({ message: "No encontrado" });

  // 🔎 AUDIT: actualización de rol
  await writeAudit(req, {
    action: "update",
    entity: "role",
    entityId: id,
    before: before
      ? { code: before.code, name: before.name, description: before.description ?? null }
      : null,
    after: { code: doc.code, name: doc.name, description: doc.description ?? null },
  });

  res.json(doc);
});

// ------------------------------------------------------------------
// ELIMINAR ROL (proteger admin)
// ------------------------------------------------------------------
r.delete("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { id } = req.params;
  const role = await IamRole.findById(id).lean();
  if (!role) return res.status(404).json({ message: "No encontrado" });

  // Proteger por code o por name plain
  const nameLc = (role.name || "").toLowerCase().trim();
  if (role.code === "admin" || nameLc === "admin" || nameLc === "administrador") {
    return res.status(400).json({ message: "No se puede eliminar admin" });
  }

  await IamRole.deleteOne({ _id: id });

  // 🔎 AUDIT: eliminación de rol
  await writeAudit(req, {
    action: "delete",
    entity: "role",
    entityId: id,
    before: { code: role.code, name: role.name, description: role.description ?? null, permissions: role.permissions || [] },
    after: null,
  });

  res.json({ ok: true });
});

// ------------------------------------------------------------------
// OBTENER PERMISOS DEL ROL (por KEYS)
// GET /api/iam/v1/roles/:id/permissions  -> { permissionKeys: string[] }
// ------------------------------------------------------------------
r.get("/:id/permissions", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const role = await IamRole.findById(req.params.id).select("permissions").lean();
  if (!role) return res.status(404).json({ message: "Rol no encontrado" });
  res.json({ permissionKeys: role.permissions || [] });
});

// ------------------------------------------------------------------
// REEMPLAZAR PERMISOS DEL ROL (por KEYS)
// PUT /api/iam/v1/roles/:id/permissions  body:{ permissionKeys: string[] }
// ------------------------------------------------------------------
r.put("/:id/permissions", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { permissionKeys = [] } = req.body || {};
  const clean = [...new Set(permissionKeys.map((k) => String(k).trim()))].filter(Boolean);

  // Validar existencia de keys en catálogo
  const cnt = await IamPermission.countDocuments({ key: { $in: clean } });
  if (cnt !== clean.length) {
    return res.status(400).json({ message: "Uno o más permisos (keys) no existen" });
  }

  // 🔎 AUDIT: before
  const before = await IamRole.findById(req.params.id).lean();

  const doc = await IamRole.findByIdAndUpdate(
    req.params.id,
    { $set: { permissions: clean } },
    { new: true }
  );

  if (!doc) return res.status(404).json({ message: "Rol no encontrado" });

  // 🔎 AUDIT: cambio de permisos del rol
  await writeAudit(req, {
    action: "update",
    entity: "role",
    entityId: req.params.id,
    before: { permissions: before?.permissions || [] },
    after:  { permissions: doc.permissions || [] },
  });

  res.json(doc);
});

export default r;
