// server/modules/iam/routes/roles.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import IamRole from "../models/IamRole.model.js";
import IamPermission from "../models/IamPermission.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

const normCode = (s = "") =>
  String(s).trim().toLowerCase().replace(/\s+/g, "_");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function cleanKeys(arr) {
  return [...new Set((arr || []).map((k) => String(k || "").trim().toLowerCase()))].filter(Boolean);
}

async function assertPermKeysExist(keys = []) {
  const clean = cleanKeys(keys);
  if (!clean.length) return clean;

  const existing = await IamPermission.find({ key: { $in: clean } })
    .select("key")
    .lean();

  const have = new Set(existing.map((x) => String(x.key || "").trim().toLowerCase()));

  if (have.size !== clean.length) {
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

/**
 * ✅ compatible con canónico + legacy
 */
const MW_ROLES_MANAGE = devOr(
  requirePerm(["iam.roles.write", "iam.roles.manage"])
);

function isProtectedRole(role) {
  if (!role) return false;

  const codeLc = String(role.code || "").trim().toLowerCase();
  const nameLc = String(role.name || "").trim().toLowerCase();

  return (
    codeLc === "admin" ||
    nameLc === "admin" ||
    nameLc === "administrador"
  );
}

r.get("/", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const items = await IamRole.find().sort({ name: 1 }).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[IAM][GET /roles] ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Error interno al listar roles",
    });
  }
});

r.post("/", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { code: rawCode, name, description, permissions = [] } = req.body || {};

    if (!name) {
      return res.status(400).json({ ok: false, message: "name es requerido" });
    }

    const code = normCode(rawCode || name);

    const dup = await IamRole.exists({ code });
    if (dup) {
      return res.status(409).json({ ok: false, message: "code ya existe" });
    }

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

    return res.status(201).json({
      ok: true,
      item: doc.toObject ? doc.toObject() : doc,
    });
  } catch (err) {
    const status = err?.status || 500;
    if (status === 400) {
      return res.status(400).json({
        ok: false,
        message: err.message,
        ...(err.payload ? err.payload : null),
      });
    }
    console.error("[IAM][POST /roles] ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Error interno al crear rol",
    });
  }
});

r.patch("/:id", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const { code, name, description } = req.body || {};
    const before = await IamRole.findById(id).lean();

    if (!before) {
      return res.status(404).json({ ok: false, message: "No encontrado" });
    }

    const protectedRole = isProtectedRole(before);
    const update = {};

    if (typeof name !== "undefined") {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ ok: false, message: "name no puede ir vacío" });
      }

      if (protectedRole) {
        const nameLc = cleanName.toLowerCase();
        if (nameLc !== "admin" && nameLc !== "administrador") {
          return res.status(400).json({
            ok: false,
            message: "No puedes cambiar el nombre del rol admin protegido.",
          });
        }
      }

      update.name = cleanName;
    }

    if (typeof description !== "undefined") {
      update.description = description;
    }

    if (typeof code !== "undefined") {
      const cleanCode = normCode(code);
      if (!cleanCode) {
        return res.status(400).json({ ok: false, message: "code no puede ir vacío" });
      }

      if (protectedRole && cleanCode !== "admin") {
        return res.status(400).json({
          ok: false,
          message: "No puedes cambiar el code del rol admin protegido.",
        });
      }

      update.code = cleanCode;
    }

    if (update.code && update.code !== before.code) {
      const exists = await IamRole.exists({
        _id: { $ne: id },
        code: update.code,
      });
      if (exists) {
        return res.status(409).json({ ok: false, message: "code ya existe" });
      }
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

    return res.json({ ok: true, item: doc });
  } catch (err) {
    console.error("[IAM][PATCH /roles/:id] ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Error interno al actualizar rol",
    });
  }
});

r.delete("/:id", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const role = await IamRole.findById(id).lean();
    if (!role) {
      return res.status(404).json({ ok: false, message: "No encontrado" });
    }

    if (isProtectedRole(role)) {
      return res.status(400).json({
        ok: false,
        message: "No se puede eliminar admin",
      });
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
      ok: false,
      message: "Error interno al eliminar rol",
    });
  }
});

r.get("/:id/permissions", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const role = await IamRole.findById(id).select("permissions").lean();
    if (!role) {
      return res.status(404).json({ ok: false, message: "Rol no encontrado" });
    }

    return res.json({
      ok: true,
      permissionKeys: cleanKeys(role.permissions || []),
    });
  } catch (err) {
    console.error("[IAM][GET /roles/:id/permissions] ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Error interno al obtener permisos del rol",
    });
  }
});

r.put("/:id/permissions", MW_ROLES_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const body = req.body || {};
    const rawPermissionKeys = Array.isArray(body.permissionKeys)
      ? body.permissionKeys
      : Array.isArray(body.permissions)
      ? body.permissions
      : [];

    const before = await IamRole.findById(id).lean();
    if (!before) {
      return res.status(404).json({ ok: false, message: "Rol no encontrado" });
    }

    const clean = await assertPermKeysExist(rawPermissionKeys);

    if (isProtectedRole(before) && !clean.length) {
      return res.status(400).json({
        ok: false,
        message: "El rol admin protegido no puede quedarse sin permisos.",
      });
    }

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
        before: { permissions: cleanKeys(before?.permissions || []) },
        after: { permissions: cleanKeys(doc?.permissions || []) },
      },
      "update role perms"
    );

    return res.json({
      ok: true,
      item: doc,
      permissionKeys: cleanKeys(doc?.permissions || []),
    });
  } catch (err) {
    const status = err?.status || 500;
    if (status === 400) {
      return res.status(400).json({
        ok: false,
        message: err.message,
        ...(err.payload ? err.payload : null),
      });
    }
    console.error("[IAM][PUT /roles/:id/permissions] ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Error interno al actualizar permisos del rol",
    });
  }
});

export default r;