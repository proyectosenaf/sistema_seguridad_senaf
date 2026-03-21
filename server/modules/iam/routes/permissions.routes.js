// server/modules/iam/routes/permissions.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import IamPermission from "../models/IamPermission.model.js";
import IamRole from "../models/IamRole.model.js";
import { requirePerm, devOr } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

const r = Router();

const MW_PERMS_MANAGE = devOr(
  requirePerm(["iam.permissions.manage", "iam.roles.manage"])
);

const PERMISSION_KEY_ALIASES = {
  "incidentes.read": "incidentes.records.read",
  "incidentes.create": "incidentes.records.write",
  "incidentes.edit": "incidentes.records.write",
  "incidentes.delete": "incidentes.records.delete",
  "incidentes.reports": "incidentes.reports.read",

  "bitacora.read": "bitacora.records.read",
  "bitacora.write": "bitacora.records.write",
  "bitacora.delete": "bitacora.records.delete",

  "accesos.read": "accesos.records.read",
  "accesos.write": "accesos.records.write",
  "accesos.delete": "accesos.records.delete",

  "visitas.read": "visitas.records.read",
  "visitas.write": "visitas.records.write",
  "visitas.delete": "visitas.records.delete",
  "visitas.close": "visitas.records.close",

  "rondasqr.read": "rondasqr.rounds.read",
  "rondasqr.write": "rondasqr.rounds.write",
};

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    ""
  );
}

function normalizeRoleValue(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim();

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    ).trim();
  }

  return String(role).trim();
}

function getPrimaryRole(userLike) {
  const roles = Array.isArray(userLike?.roles) ? userLike.roles : [];
  return normalizeRoleValue(roles[0] || "");
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

async function bitacoraSafe(req, payload, label) {
  try {
    await logBitacoraEvent({
      modulo: "IAM",
      tipo: "IAM",
      prioridad: payload.prioridad || "Media",
      estado: payload.estado || "Registrado",
      source: payload.source || "iam-permissions",
      agente:
        req?.user?.email ||
        req?.user?.name ||
        payload.agente ||
        "Sistema IAM",
      actorId:
        req?.user?.sub ||
        req?.user?._id ||
        req?.user?.id ||
        payload.actorId ||
        "",
      actorEmail: req?.user?.email || payload.actorEmail || "",
      actorRol: getPrimaryRole(req?.user) || payload.actorRol || "",
      ip: clientIp(req),
      userAgent: req?.get?.("user-agent") || "",
      ...payload,
    });
  } catch (e) {
    console.warn(
      `[IAM][BITACORA ${label}] error (no bloquea):`,
      e?.message || e
    );
  }
}

function inferGroupFromKey(key = "") {
  const k = String(key || "").trim().toLowerCase();
  if (!k.includes(".")) return "";
  return k.split(".")[0] || "";
}

function canonicalizePermissionKey(rawKey = "", rawGroup = "") {
  let key = String(rawKey || "").trim().toLowerCase();
  const group = String(rawGroup || "").trim().toLowerCase();

  if (group && key && !key.includes(".")) {
    key = `${group}.${key}`;
  }

  if (PERMISSION_KEY_ALIASES[key]) {
    key = PERMISSION_KEY_ALIASES[key];
  }

  return key;
}

function normalizePerm(p = {}) {
  let key = canonicalizePermissionKey(p.key ?? "", p.group ?? "");
  let group = String(p.group ?? "").trim().toLowerCase();

  if (!group) group = inferGroupFromKey(key);

  const label = String(p.label ?? "").trim();
  const orderNum = Number(p.order);
  const order = Number.isFinite(orderNum) ? Math.trunc(orderNum) : 0;

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
  const hasKey = body.key != null;
  const hasGroup = body.group != null;

  let key = hasKey ? String(body.key).trim().toLowerCase() : undefined;
  let group = hasGroup ? String(body.group).trim().toLowerCase() : undefined;

  if (key != null) {
    key = canonicalizePermissionKey(key, group || "");
  }

  if ((group == null || !group) && key) {
    group = inferGroupFromKey(key);
  }

  const out = {};

  if (key != null) out.key = key;
  if (body.label != null) out.label = String(body.label).trim();
  if (group != null) out.group = group;

  if (body.order != null && String(body.order).trim() !== "") {
    const n = Number(body.order);
    out.order = Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  return out;
}

async function replacePermissionKeyInRoles(prevKey, nextKey) {
  if (!prevKey || !nextKey || prevKey === nextKey) return;

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

    const groups = [...groupMap.entries()].map(([g, items]) => ({
      group: g,
      items,
    }));

    return res.json({
      ok: true,
      count: annotated.length,
      groupsCount: groups.length,
      items: annotated,
      groups,
    });
  } catch (err) {
    console.error("[IAM][GET /permissions] ERROR:", err);

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_LIST",
        entidad: "IamPermission",
        titulo: "Error listando permisos",
        descripcion: err?.message || "Error listando permisos",
        estado: "Fallido",
        prioridad: "Alta",
      },
      "list permissions error"
    );

    return res
      .status(500)
      .json({ message: "Error listando permisos", error: err.message });
  }
});

/* =========================
   CREATE
========================= */
r.post("/", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const input = normalizePerm(req.body || {});
    const errors = validatePerm(input);

    if (errors.length) {
      return res
        .status(400)
        .json({ message: "Validación fallida", errors });
    }

    const exists = await IamPermission.exists({ key: input.key });
    if (exists) {
      return res
        .status(409)
        .json({ message: "Ya existe un permiso con esa key" });
    }

    const doc = await IamPermission.create(input);

    const after = {
      key: doc.key,
      label: doc.label,
      group: doc.group,
      order: doc.order ?? 0,
    };

    await auditSafe(
      req,
      {
        action: "create",
        entity: "permission",
        entityId: doc._id.toString(),
        before: null,
        after,
      },
      "create permission"
    );

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_CREATE",
        entidad: "IamPermission",
        entidadId: doc._id.toString(),
        titulo: `Permiso creado: ${doc.key}`,
        descripcion: `Se creó el permiso ${doc.key}.`,
        before: null,
        after,
        estado: "Exitoso",
        prioridad: "Media",
        nombre: doc.label || doc.key,
      },
      "create permission"
    );

    return res.status(201).json(doc);
  } catch (err) {
    console.error("[IAM][POST /permissions] ERROR:", err);

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_CREATE",
        entidad: "IamPermission",
        titulo: "Error creando permiso",
        descripcion: err?.message || "Error creando permiso",
        estado: "Fallido",
        prioridad: "Alta",
        after: req.body || null,
      },
      "create permission error"
    );

    return res
      .status(500)
      .json({ message: "Error creando permiso", error: err.message });
  }
});

/* =========================
   UPDATE
========================= */
r.patch("/:id", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const update = pickUpdatable(req.body);

    if (update.key && !/^[a-z0-9_.-]+$/i.test(update.key)) {
      return res.status(400).json({
        message: "key solo puede contener letras, números, . _ -",
      });
    }

    const prev = await IamPermission.findById(id).lean();
    if (!prev) return res.status(404).json({ message: "No encontrado" });

    if (update.key && update.key !== prev.key) {
      const dup = await IamPermission.exists({
        _id: { $ne: id },
        key: update.key,
      });
      if (dup) {
        return res
          .status(409)
          .json({ message: "Ya existe un permiso con esa key" });
      }
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

    const before = {
      key: prev.key,
      label: prev.label,
      group: prev.group,
      order: prev.order ?? 0,
    };

    const after = {
      key: doc.key,
      label: doc.label,
      group: doc.group,
      order: doc.order ?? 0,
    };

    await auditSafe(
      req,
      {
        action: "update",
        entity: "permission",
        entityId: id,
        before,
        after,
      },
      "update permission"
    );

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_UPDATE",
        entidad: "IamPermission",
        entidadId: id,
        titulo: `Permiso actualizado: ${doc.key}`,
        descripcion: `Se actualizó el permiso ${doc.key}.`,
        before,
        after,
        estado: "Exitoso",
        prioridad: "Media",
        nombre: doc.label || doc.key,
      },
      "update permission"
    );

    return res.json(doc);
  } catch (err) {
    console.error("[IAM][PATCH /permissions/:id] ERROR:", err);

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_UPDATE",
        entidad: "IamPermission",
        entidadId: req.params?.id || "",
        titulo: "Error actualizando permiso",
        descripcion: err?.message || "Error actualizando permiso",
        estado: "Fallido",
        prioridad: "Alta",
        after: req.body || null,
      },
      "update permission error"
    );

    return res
      .status(500)
      .json({ message: "Error actualizando permiso", error: err.message });
  }
});

/* =========================
   DELETE
========================= */
r.delete("/:id", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const perm = await IamPermission.findById(id).lean();
    if (!perm) return res.status(404).json({ message: "No encontrado" });

    const del = await IamPermission.deleteOne({ _id: id });
    if (del.deletedCount === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    await IamRole.updateMany(
      { permissions: perm.key },
      { $pull: { permissions: perm.key } }
    );

    const before = {
      key: perm.key,
      label: perm.label,
      group: perm.group,
      order: perm.order ?? 0,
    };

    await auditSafe(
      req,
      {
        action: "delete",
        entity: "permission",
        entityId: id,
        before,
        after: null,
      },
      "delete permission"
    );

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_DELETE",
        entidad: "IamPermission",
        entidadId: id,
        titulo: `Permiso eliminado: ${perm.key}`,
        descripcion: `Se eliminó el permiso ${perm.key} y se retiró de los roles asociados.`,
        before,
        after: null,
        estado: "Exitoso",
        prioridad: "Alta",
        nombre: perm.label || perm.key,
      },
      "delete permission"
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[IAM][DELETE /permissions/:id] ERROR:", err);

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_DELETE",
        entidad: "IamPermission",
        entidadId: req.params?.id || "",
        titulo: "Error eliminando permiso",
        descripcion: err?.message || "Error eliminando permiso",
        estado: "Fallido",
        prioridad: "Alta",
      },
      "delete permission error"
    );

    return res
      .status(500)
      .json({ message: "Error eliminando permiso", error: err.message });
  }
});

/* =========================
   SYNC (bulk)
========================= */
r.post("/sync", MW_PERMS_MANAGE, async (req, res) => {
  try {
    const { permissions = [], dryRun = false } = req.body || {};

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        message: "permissions debe ser un arreglo no vacío",
      });
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

    const wouldCreate = list
      .filter((p) => !existSet.has(p.key))
      .map((p) => p.key);

    const wouldUpdate = list
      .filter((p) => existSet.has(p.key))
      .map((p) => p.key);

    if (dryRun) {
      await bitacoraSafe(
        req,
        {
          accion: "PERMISSION_SYNC_DRYRUN",
          entidad: "IamPermission",
          entidadId: "bulk",
          titulo: "Dry run de sincronización de permisos",
          descripcion:
            "Se ejecutó una simulación de sincronización de permisos.",
          before: null,
          after: {
            totalReceived: permissions.length,
            totalUnique: list.length,
            duplicateKeys: [...dupKeys],
            wouldCreateCount: wouldCreate.length,
            wouldUpdateCount: wouldUpdate.length,
            wouldCreate,
            wouldUpdate,
          },
          estado: "Exitoso",
          prioridad: "Media",
        },
        "sync permissions dryrun"
      );

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
        update: {
          $set: {
            label: p.label,
            group: p.group,
            order: p.order ?? 0,
          },
        },
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

    const after = {
      totalReceived: permissions.length,
      totalUnique: list.length,
      created,
      matched,
      modified,
      keysCreated: wouldCreate,
      keysUpdated: wouldUpdate,
      duplicateKeys: [...dupKeys],
    };

    await auditSafe(
      req,
      {
        action: "update",
        entity: "permission",
        entityId: "bulk",
        before: null,
        after,
      },
      "sync permissions"
    );

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_SYNC",
        entidad: "IamPermission",
        entidadId: "bulk",
        titulo: "Sincronización de permisos",
        descripcion: "Se sincronizó el catálogo de permisos.",
        before: null,
        after,
        estado: "Exitoso",
        prioridad: "Alta",
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
      duplicateKeys: [...dupKeys],
    });
  } catch (err) {
    console.error("[IAM][POST /permissions/sync] ERROR:", err);

    await bitacoraSafe(
      req,
      {
        accion: "PERMISSION_SYNC",
        entidad: "IamPermission",
        entidadId: "bulk",
        titulo: "Error sincronizando permisos",
        descripcion: err?.message || "Error sincronizando permisos",
        estado: "Fallido",
        prioridad: "Alta",
        after: req.body || null,
      },
      "sync permissions error"
    );

    return res
      .status(500)
      .json({ message: "Error sincronizando permisos", error: err.message });
  }
});

export default r;