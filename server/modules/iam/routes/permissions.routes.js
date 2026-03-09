// server/modules/iam/routes/permissions.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import IamPermission from "../models/IamPermission.model.js";
import IamRole from "../models/IamRole.model.js";
import { requirePerm, devOr } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

/**
 * ✅ Nota clave:
 * - permissions CRUD debe estar protegido por "iam.permissions.manage"
 * - "iam.roles.manage" es para roles, no para permisos.
 * - Para no romper instalaciones donde aún no existe ese permiso, aceptamos ambos.
 */
const MW_PERMS_MANAGE = devOr(
  requirePerm(["iam.permissions.manage", "iam.roles.manage"])
);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function auditSafe(req, payload, label) {
  try {
    return Promise.resolve(writeAudit?.(req, payload)).catch((e) => {
      console.warn(`[IAM][AUDIT ${label}] error (no bloquea):`, e?.message || e);
    });
  } catch (e) {
    console.warn(`[IAM][AUDIT ${label}] error (no bloquea):`, e?.message || e);
    return Promise.resolve();
  }
}

function normalizePerm(p = {}) {
  let key = String(p.key ?? "").trim().toLowerCase();
  const label = String(p.label ?? "").trim();
  const group = String(p.group ?? "").trim().toLowerCase();

  const orderNum = Number(p.order);
  const order = Number.isFinite(orderNum) ? Math.trunc(orderNum) : 0;

  if (group && key && !key.includes(".")) key = `${group}.${key}`;

  return { key, label, group, order };
}

function validatePerm(p) {
  const errors = [];
  if (!p.key) errors.push("key es requerido");
  if (!p.label) errors.push("label es requerido");
  if (!p.group) errors.push("group es requerido");

  if (p.key && !/^[a-z0-9_.-]+$/i.test(p.key)) {
    errors.push("key solo puede contener letras, números, . _ -");
  }
  if (p.order != null && !Number.isInteger(p.order)) {
    errors.push("order debe ser entero");
  }
  return errors;
}

function pickUpdatable(body = {}) {
  const out = {};

  if (body.key != null) out.key = String(body.key).trim().toLowerCase();
  if (body.label != null) out.label = String(body.label).trim();
  if (body.group != null) out.group = String(body.group).trim().toLowerCase();

  if (body.order != null && String(body.order).trim() !== "") {
    const n = Number(body.order);
    out.order = Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  if (out.group && out.key && !out.key.includes(".")) out.key = `${out.group}.${out.key}`;

  return out;
}

async function replacePermissionKeyInRoles(prevKey, nextKey) {
  if (!prevKey || !nextKey || prevKey === nextKey) return;

  // MongoDB 4.2+ pipeline update
  await IamRole.updateMany(
    { permissions: prevKey },
    [
      {
        $set: {
          permissions: {
            $map: {
              input: "$permissions",
              as: "p",
              in: { $cond: [{ $eq: ["$$p", prevKey] }, nextKey, "$$p"] },
            },
          },
        },
      },
    ]
  );
}

/* =========================
   LIST
========================= */
r.get("/", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { group, q, role: roleId } = req.query;

    const filter = {};
    if (group) filter.group = String(group).trim().toLowerCase();

    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      filter.$or = [{ key: rx }, { label: rx }, { group: rx }];
    }

    const docs = await IamPermission.find(filter)
      .sort({ group: 1, order: 1, key: 1 })
      .lean();

    let selectedSet = null;
    if (roleId && isValidObjectId(roleId)) {
      const role = await IamRole.findById(roleId).select("permissions").lean();
      if (role?.permissions?.length) selectedSet = new Set(role.permissions);
    }

    const annotated = selectedSet
      ? docs.map((d) => ({ ...d, selected: selectedSet.has(d.key) }))
      : docs;

    const groupMap = new Map();
    for (const d of annotated) {
      const g = d.group || "general";
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g).push(d);
    }
    const groups = [...groupMap.entries()].map(([g, items]) => ({ group: g, items }));

    return res.json({
      ok: true,
      count: annotated.length,
      groupsCount: groups.length,
      items: annotated,
      groups,
    });
  } catch (err) {
    console.error("[IAM][GET /permissions] ERROR:", err);
    return res.status(500).json({ message: "Error listando permisos", error: err.message });
  }
});

/* =========================
   CREATE
========================= */
r.post("/", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const input = normalizePerm(req.body || {});
    const errors = validatePerm(input);
    if (errors.length) return res.status(400).json({ message: "Validación fallida", errors });

    const exists = await IamPermission.exists({ key: input.key });
    if (exists) return res.status(409).json({ message: "Ya existe un permiso con esa key" });

    const doc = await IamPermission.create(input);

    await auditSafe(
      req,
      {
        action: "create",
        entity: "permission",
        entityId: doc._id.toString(),
        before: null,
        after: { key: doc.key, label: doc.label, group: doc.group, order: doc.order ?? 0 },
      },
      "create permission"
    );

    return res.status(201).json(doc);
  } catch (err) {
    console.error("[IAM][POST /permissions] ERROR:", err);
    return res.status(500).json({ message: "Error creando permiso", error: err.message });
  }
});

/* =========================
   UPDATE
========================= */
r.patch("/:id", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "ID inválido" });

    const update = pickUpdatable(req.body);

    if (update.key && !/^[a-z0-9_.-]+$/i.test(update.key)) {
      return res.status(400).json({ message: "key solo puede contener letras, números, . _ -" });
    }

    const prev = await IamPermission.findById(id).lean();
    if (!prev) return res.status(404).json({ message: "No encontrado" });

    if (update.key && update.key !== prev.key) {
      const dup = await IamPermission.exists({ _id: { $ne: id }, key: update.key });
      if (dup) return res.status(409).json({ message: "Ya existe un permiso con esa key" });
    }

    const doc = await IamPermission.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) return res.status(404).json({ message: "No encontrado" });

    if (update.key && update.key !== prev.key) {
      await replacePermissionKeyInRoles(prev.key, update.key);
    }

    await auditSafe(
      req,
      {
        action: "update",
        entity: "permission",
        entityId: id,
        before: { key: prev.key, label: prev.label, group: prev.group, order: prev.order ?? 0 },
        after: { key: doc.key, label: doc.label, group: doc.group, order: doc.order ?? 0 },
      },
      "update permission"
    );

    return res.json(doc);
  } catch (err) {
    console.error("[IAM][PATCH /permissions/:id] ERROR:", err);
    return res.status(500).json({ message: "Error actualizando permiso", error: err.message });
  }
});

/* =========================
   DELETE
========================= */
r.delete("/:id", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "ID inválido" });

    const perm = await IamPermission.findById(id).lean();
    if (!perm) return res.status(404).json({ message: "No encontrado" });

    const del = await IamPermission.deleteOne({ _id: id });
    if (del.deletedCount === 0) return res.status(404).json({ message: "No encontrado" });

    await IamRole.updateMany({ permissions: perm.key }, { $pull: { permissions: perm.key } });

    await auditSafe(
      req,
      {
        action: "delete",
        entity: "permission",
        entityId: id,
        before: { key: perm.key, label: perm.label, group: perm.group, order: perm.order ?? 0 },
        after: null,
      },
      "delete permission"
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[IAM][DELETE /permissions/:id] ERROR:", err);
    return res.status(500).json({ message: "Error eliminando permiso", error: err.message });
  }
});

/* =========================
   SYNC (bulk)
========================= */
r.post("/sync", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { permissions = [], dryRun = false } = req.body || {};

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ message: "permissions debe ser un arreglo no vacío" });
    }

    const map = new Map();
    const allErrors = [];
    const dupKeys = new Set();

    for (const raw of permissions) {
      const p = normalizePerm(raw);
      const errs = validatePerm(p);
      if (errs.length) {
        allErrors.push({ key: raw?.key ?? "(sin key)", errors: errs });
        continue;
      }
      if (map.has(p.key)) dupKeys.add(p.key);
      map.set(p.key, p);
    }

    if (allErrors.length) {
      return res.status(400).json({
        message: "Validación fallida en uno o más items",
        details: allErrors,
      });
    }

    const list = [...map.values()];

    const existing = await IamPermission.find(
      { key: { $in: list.map((p) => p.key) } },
      { key: 1 }
    ).lean();
    const existSet = new Set(existing.map((e) => e.key));

    const wouldCreate = list.filter((p) => !existSet.has(p.key)).map((p) => p.key);
    const wouldUpdate = list.filter((p) => existSet.has(p.key)).map((p) => p.key);

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        totalReceived: permissions.length,
        totalUnique: list.length,
        duplicateKeys: [...dupKeys],
        wouldCreateCount: wouldCreate.length,
        wouldUpdateCount: wouldUpdate.length,
        wouldCreate,
        wouldUpdate,
      });
    }

    const ops = list.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: { $set: { label: p.label, group: p.group, order: p.order ?? 0 } },
        upsert: true,
      },
    }));

    const result = await IamPermission.bulkWrite(ops, { ordered: false });

    const created =
      (result.upsertedCount != null
        ? result.upsertedCount
        : Object.keys(result.upsertedIds || {}).length) || 0;

    const matched = result.matchedCount ?? 0;
    const modified = result.modifiedCount ?? 0;

    await auditSafe(
      req,
      {
        action: "update",
        entity: "permission",
        entityId: "bulk",
        before: null,
        after: {
          totalReceived: permissions.length,
          totalUnique: list.length,
          created,
          matched,
          modified,
          keysCreated: wouldCreate,
          keysUpdated: wouldUpdate,
        },
      },
      "sync permissions"
    );

    return res.json({
      ok: true,
      totalReceived: permissions.length,
      totalUnique: list.length,
      created,
      matched,
      modified,
    });
  } catch (err) {
    console.error("[IAM][POST /permissions/sync] ERROR:", err);
    return res.status(500).json({ message: "Error sincronizando permisos", error: err.message });
  }
});

export default r;