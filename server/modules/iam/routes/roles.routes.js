// modules/iam/routes/roles.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import IamRole from "../models/IamRole.model.js";
import IamPermission from "../models/IamPermission.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

/* =========================
   Helpers (centralizados)
========================= */

const normCode = (s = "") =>
  String(s).trim().toLowerCase().replace(/\s+/g, "_");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function cleanKeys(arr) {
  return [...new Set((arr || []).map((k) => String(k || "").trim()))].filter(Boolean);
}

/** Valida que todas las permission keys existan */
async function assertPermKeysExist(keys = []) {
  const clean = cleanKeys(keys);
  if (!clean.length) return clean;

  // countDocuments funciona, pero evita falsos si hay duplicados (ya limpiamos)
  const cnt = await IamPermission.countDocuments({ key: { $in: clean } });
  if (cnt !== clean.length) {
    const existing = await IamPermission.find({ key: { $in: clean } })
      .select("key")
      .lean();
    const have = new Set(existing.map((x) => x.key));
    const missing = clean.filter((k) => !have.has(k));

    const err = new Error("Uno o más permisos (keys) no existen");
    err.status = 400;
    err.payload = { missing };
    throw err;
  }

  return clean;
}

async function auditSafe(req, payload, label) {
  try {
    await writeAudit(req, payload);
  } catch (e) {
    console.warn(`[IAM][AUDIT ${label}] error (no bloquea):`, e?.message || e);
  }
}

/* =========================
   Middleware base
========================= */
const MW_ROLES_MANAGE = devOr(requirePerm("iam.roles.manage"));

/* =========================
   LISTAR ROLES
========================= */
r.get("/", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const items = await IamRole.find().sort({ name: 1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("[IAM][GET /roles] ERROR:", err);
    return res.status(500).json({
      message: "Error interno al listar roles",
      error: err.message,
    });
  }
});

/* =========================
   CREAR ROL
   body: { code?, name, description?, permissions? (array de KEYS) }
========================= */
r.post("/", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { code: rawCode, name, description, permissions = [] } = req.body || {};
    if (!name) return res.status(400).json({ message: "name es requerido" });

    const code = normCode(rawCode || name);

    // duplicado por code
    const dup = await IamRole.exists({ code });
    if (dup) return res.status(409).json({ message: "code ya existe" });

    const cleanPerms = await assertPermKeysExist(permissions);

    const doc = await IamRole.create({
      code,
      name: String(name).trim(),
      description: typeof description === "undefined" ? "" : description,
      permissions: cleanPerms,
    });

    await auditSafe(
      req,
      {
        action: "create",
        entity: "role",
        entityId: doc._id.toString(),
        before: null,
        after: {
          code: doc.code,
          name: doc.name,
          description: doc.description ?? null,
          permissions: doc.permissions || [],
        },
      },
      "create role"
    );

    return res.status(201).json(doc);
  } catch (err) {
    const status = err?.status || 500;
    if (status === 400) {
      return res.status(400).json({
        message: err.message,
        ...(err.payload ? err.payload : null),
      });
    }
    console.error("[IAM][POST /roles] ERROR:", err);
    return res.status(500).json({
      message: "Error interno al crear rol",
      error: err.message,
    });
  }
});

/* =========================
   ACTUALIZAR ROL (name/code/description)
========================= */
r.patch("/:id", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "ID inválido" });

    const { code, name, description } = req.body || {};

    const update = {};
    if (typeof name !== "undefined") update.name = String(name).trim();
    if (typeof description !== "undefined") update.description = description;
    if (typeof code !== "undefined") update.code = normCode(code);

    // before (audit)
    const before = await IamRole.findById(id).lean();
    if (!before) return res.status(404).json({ message: "No encontrado" });

    // si cambia code, validar duplicado
    if (update.code && update.code !== before.code) {
      const exists = await IamRole.exists({ _id: { $ne: id }, code: update.code });
      if (exists) return res.status(409).json({ message: "code ya existe" });
    }

    const doc = await IamRole.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    await auditSafe(
      req,
      {
        action: "update",
        entity: "role",
        entityId: id,
        before: {
          code: before.code,
          name: before.name,
          description: before.description ?? null,
        },
        after: {
          code: doc.code,
          name: doc.name,
          description: doc.description ?? null,
        },
      },
      "update role"
    );

    return res.json(doc);
  } catch (err) {
    console.error("[IAM][PATCH /roles/:id] ERROR:", err);
    return res.status(500).json({
      message: "Error interno al actualizar rol",
      error: err.message,
    });
  }
});

/* =========================
   ELIMINAR ROL (proteger admin)
========================= */
r.delete("/:id", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "ID inválido" });

    const role = await IamRole.findById(id).lean();
    if (!role) return res.status(404).json({ message: "No encontrado" });

    const codeLc = String(role.code || "").toLowerCase().trim();
    const nameLc = String(role.name || "").toLowerCase().trim();

    if (codeLc === "admin" || nameLc === "admin" || nameLc === "administrador") {
      return res.status(400).json({ message: "No se puede eliminar admin" });
    }

    await IamRole.deleteOne({ _id: id });

    await auditSafe(
      req,
      {
        action: "delete",
        entity: "role",
        entityId: id,
        before: {
          code: role.code,
          name: role.name,
          description: role.description ?? null,
          permissions: role.permissions || [],
        },
        after: null,
      },
      "delete role"
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[IAM][DELETE /roles/:id] ERROR:", err);
    return res.status(500).json({
      message: "Error interno al eliminar rol",
      error: err.message,
    });
  }
});

/* =========================
   OBTENER PERMISOS DEL ROL (por KEYS)
   GET /api/iam/v1/roles/:id/permissions  -> { permissionKeys: string[] }
========================= */
r.get("/:id/permissions", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "ID inválido" });

    const role = await IamRole.findById(id).select("permissions").lean();
    if (!role) return res.status(404).json({ message: "Rol no encontrado" });

    return res.json({ permissionKeys: role.permissions || [] });
  } catch (err) {
    console.error("[IAM][GET /roles/:id/permissions] ERROR:", err);
    return res.status(500).json({
      message: "Error interno al obtener permisos del rol",
      error: err.message,
    });
  }
});

/* =========================
   REEMPLAZAR PERMISOS DEL ROL (por KEYS)
   PUT /api/iam/v1/roles/:id/permissions  body:{ permissionKeys: string[] }
========================= */
r.put("/:id/permissions", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "ID inválido" });

    const { permissionKeys = [] } = req.body || {};

    // before (audit)
    const before = await IamRole.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Rol no encontrado" });

    const clean = await assertPermKeysExist(permissionKeys);

    const doc = await IamRole.findByIdAndUpdate(
      id,
      { $set: { permissions: clean } },
      { new: true, runValidators: true }
    ).lean();

    await auditSafe(
      req,
      {
        action: "update",
        entity: "role",
        entityId: id,
        before: { permissions: before?.permissions || [] },
        after: { permissions: doc?.permissions || [] },
      },
      "update role perms"
    );

    return res.json(doc);
  } catch (err) {
    const status = err?.status || 500;
    if (status === 400) {
      return res.status(400).json({
        message: err.message,
        ...(err.payload ? err.payload : null),
      });
    }
    console.error("[IAM][PUT /roles/:id/permissions] ERROR:", err);
    return res.status(500).json({
      message: "Error interno al actualizar permisos del rol",
      error: err.message,
    });
  }
});

export default r;