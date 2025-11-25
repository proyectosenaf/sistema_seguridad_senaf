// modules/iam/routes/roles.routes.js
import { Router } from "express";
import IamRole from "../models/IamRole.model.js";
import IamPermission from "../models/IamPermission.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

const normCode = (s = "") =>
  String(s).trim().toLowerCase().replace(/\s+/g, "_");

// ------------------------------------------------------------------
// LISTAR ROLES
// ------------------------------------------------------------------
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const items = await IamRole.find().sort({ name: 1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("[IAM][GET /roles] ERROR:", err);
    return res
      .status(500)
      .json({ message: "Error interno al listar roles", error: err.message });
  }
});

// ------------------------------------------------------------------
// CREAR ROL
// body: { code?, name, description?, permissions? (array de KEYS) }
// ------------------------------------------------------------------
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { code: rawCode, name, description, permissions = [] } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: "name es requerido" });
    }

    const code = normCode(rawCode || name);

    // Validar duplicados por code
    const dup = await IamRole.exists({ code });
    if (dup) {
      return res.status(409).json({ message: "code ya existe" });
    }

    // Normalizar permisos a array de strings limpios
    const cleanPerms = [...new Set(
      (permissions || []).map((k) => String(k || "").trim())
    )].filter(Boolean);

    // Validar que todas las keys de permisos existan
    if (cleanPerms.length) {
      const cnt = await IamPermission.countDocuments({ key: { $in: cleanPerms } });
      if (cnt !== cleanPerms.length) {
        return res
          .status(400)
          .json({ message: "Uno o más permisos (keys) no existen" });
      }
    }

    const doc = await IamRole.create({
      code,
      name: String(name).trim(),
      description,
      permissions: cleanPerms,
    });

    // AUDIT: creación de rol
    try {
      await writeAudit(req, {
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
      });
    } catch (auditErr) {
      console.warn("[IAM][AUDIT create role] error (no bloquea):", auditErr);
    }

    return res.status(201).json(doc);
  } catch (err) {
    console.error("[IAM][POST /roles] ERROR:", err);
    return res
      .status(500)
      .json({ message: "Error interno al crear rol", error: err.message });
  }
});

// ------------------------------------------------------------------
// ACTUALIZAR ROL (name/code/description)
// ------------------------------------------------------------------
r.patch("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description } = req.body || {};

    const update = {};
    if (typeof name !== "undefined") update.name = String(name).trim();
    if (typeof description !== "undefined") update.description = description;
    if (typeof code !== "undefined") update.code = normCode(code);

    // Si viene code nuevo, verificar duplicado
    if (update.code) {
      const exists = await IamRole.exists({ _id: { $ne: id }, code: update.code });
      if (exists) {
        return res.status(409).json({ message: "code ya existe" });
      }
    }

    // AUDIT: capturar estado previo
    const before = await IamRole.findById(id).lean();

    const doc = await IamRole.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ message: "No encontrado" });
    }

    // AUDIT: actualización de rol
    try {
      await writeAudit(req, {
        action: "update",
        entity: "role",
        entityId: id,
        before: before
          ? {
              code: before.code,
              name: before.name,
              description: before.description ?? null,
            }
          : null,
        after: {
          code: doc.code,
          name: doc.name,
          description: doc.description ?? null,
        },
      });
    } catch (auditErr) {
      console.warn("[IAM][AUDIT update role] error (no bloquea):", auditErr);
    }

    return res.json(doc);
  } catch (err) {
    console.error("[IAM][PATCH /roles/:id] ERROR:", err);
    return res
      .status(500)
      .json({ message: "Error interno al actualizar rol", error: err.message });
  }
});

// ------------------------------------------------------------------
// ELIMINAR ROL (proteger admin)
// ------------------------------------------------------------------
r.delete("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { id } = req.params;
    const role = await IamRole.findById(id).lean();
    if (!role) {
      return res.status(404).json({ message: "No encontrado" });
    }

    // Proteger por code o por name plain
    const nameLc = (role.name || "").toLowerCase().trim();
    if (
      role.code === "admin" ||
      nameLc === "admin" ||
      nameLc === "administrador"
    ) {
      return res
        .status(400)
        .json({ message: "No se puede eliminar admin" });
    }

    await IamRole.deleteOne({ _id: id });

    // AUDIT: eliminación de rol
    try {
      await writeAudit(req, {
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
      });
    } catch (auditErr) {
      console.warn("[IAM][AUDIT delete role] error (no bloquea):", auditErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[IAM][DELETE /roles/:id] ERROR:", err);
    return res
      .status(500)
      .json({ message: "Error interno al eliminar rol", error: err.message });
  }
});

// ------------------------------------------------------------------
// OBTENER PERMISOS DEL ROL (por KEYS)
// GET /api/iam/v1/roles/:id/permissions  -> { permissionKeys: string[] }
// ------------------------------------------------------------------
r.get(
  "/:id/permissions",
  devOr(requirePerm("iam.roles.manage")),
  async (req, res) => {
    try {
      const role = await IamRole.findById(req.params.id)
        .select("permissions")
        .lean();
      if (!role) {
        return res.status(404).json({ message: "Rol no encontrado" });
      }
      return res.json({ permissionKeys: role.permissions || [] });
    } catch (err) {
      console.error("[IAM][GET /roles/:id/permissions] ERROR:", err);
      return res.status(500).json({
        message: "Error interno al obtener permisos del rol",
        error: err.message,
      });
    }
  }
);

// ------------------------------------------------------------------
// REEMPLAZAR PERMISOS DEL ROL (por KEYS)
// PUT /api/iam/v1/roles/:id/permissions  body:{ permissionKeys: string[] }
// ------------------------------------------------------------------
r.put(
  "/:id/permissions",
  devOr(requirePerm("iam.roles.manage")),
  async (req, res) => {
    try {
      const { permissionKeys = [] } = req.body || {};
      const clean = [...new Set(
        (permissionKeys || []).map((k) => String(k || "").trim())
      )].filter(Boolean);

      // Validar existencia de keys en catálogo
      if (clean.length) {
        const cnt = await IamPermission.countDocuments({ key: { $in: clean } });
        if (cnt !== clean.length) {
          return res
            .status(400)
            .json({ message: "Uno o más permisos (keys) no existen" });
        }
      }

      // AUDIT: before
      const before = await IamRole.findById(req.params.id).lean();

      const doc = await IamRole.findByIdAndUpdate(
        req.params.id,
        { $set: { permissions: clean } },
        { new: true }
      );

      if (!doc) {
        return res.status(404).json({ message: "Rol no encontrado" });
      }

      // AUDIT: cambio de permisos del rol
      try {
        await writeAudit(req, {
          action: "update",
          entity: "role",
          entityId: req.params.id,
          before: { permissions: before?.permissions || [] },
          after: { permissions: doc.permissions || [] },
        });
      } catch (auditErr) {
        console.warn("[IAM][AUDIT update role perms] error (no bloquea):", auditErr);
      }

      return res.json(doc);
    } catch (err) {
      console.error("[IAM][PUT /roles/:id/permissions] ERROR:", err);
      return res.status(500).json({
        message: "Error interno al actualizar permisos del rol",
        error: err.message,
      });
    }
  }
);

export default r;
