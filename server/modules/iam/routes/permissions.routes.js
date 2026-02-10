import { Router } from "express";
import IamPermission from "../models/IamPermission.model.js";
import IamRole from "../models/IamRole.model.js";
import { requirePerm, devOr } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

/* =========================
 * Helpers
 * =======================*/

/** Normaliza un permiso recibido desde el front */
function normalizePerm(p = {}) {
  let key = String(p.key ?? "").trim().toLowerCase();
  const label = String(p.label ?? "").trim();
  const group = String(p.group ?? "").trim().toLowerCase();
  const order = Number.isFinite(p.order) ? Number(p.order) : 0;

  // ✅ Auto-namespace: si viene "create" y group="rondas" => "rondas.create"
  if (group && key && !key.includes(".")) {
    key = `${group}.${key}`;
  }

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

  // ✅ Política recomendada: obligar namespace (descomenta si quieres forzarlo estrictamente)
  // if (p.key && !p.key.includes(".")) {
  //   errors.push("key debe incluir namespace: modulo.accion (ej: rondas.create)");
  // }

  return errors;
}

/** Sanitiza objetos para updates (whitelist) */
function pickUpdatable(body = {}) {
  const out = {};
  if (body.key != null) out.key = String(body.key).trim().toLowerCase();
  if (body.label != null) out.label = String(body.label).trim();
  if (body.group != null) out.group = String(body.group).trim().toLowerCase();
  if (body.order != null) out.order = Number(body.order) || 0;

  // ✅ si cambian group + key sin namespace, prefijar
  if (out.group && out.key && !out.key.includes(".")) {
    out.key = `${out.group}.${out.key}`;
  }

  return out;
}

/* =========================
 * Rutas
 * =======================*/

/**
 * GET /api/iam/v1/permissions
 * Lista permisos. Soporta filtros básicos (?group=, ?q=) y anotación por rol (?role=<roleId>).
 * Devuelve items y groups estructurados. Si se pasa role, incluye {selected}.
 */
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { group, q, role: roleId } = req.query;

    const filter = {};

    // ✅ normaliza group del query
    if (group) filter.group = String(group).trim().toLowerCase();

    if (q) {
      const rx = new RegExp(
        String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filter.$or = [{ key: rx }, { label: rx }, { group: rx }];
    }

    const docs = await IamPermission.find(filter)
      .sort({ group: 1, order: 1, key: 1 })
      .lean();

    // Si viene rol, anotar selected comparando por KEY
    let selectedSet = null;
    if (roleId) {
      const role = await IamRole.findById(roleId)
        .select("permissions")
        .lean();
      if (role?.permissions?.length) selectedSet = new Set(role.permissions);
    }
    const annotated = selectedSet
      ? docs.map((d) => ({ ...d, selected: selectedSet.has(d.key) }))
      : docs;

    // Estructura por grupo: [{ group: 'rondas', items: [...] }, ...]
    const groupMap = new Map();
    for (const d of annotated) {
      if (!groupMap.has(d.group)) groupMap.set(d.group, []);
      groupMap.get(d.group).push(d);
    }
    const groups = [...groupMap.entries()].map(([g, items]) => ({
      group: g,
      items,
    }));

    res.json({
      count: annotated.length,
      groupsCount: groups.length,
      items: annotated,
      groups,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error listando permisos", error: err.message });
  }
});

/**
 * POST /api/iam/v1/permissions
 * Crea un permiso individual (evita duplicados por key).
 */
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const input = normalizePerm(req.body || {});
    const errors = validatePerm(input);
    if (errors.length)
      return res
        .status(400)
        .json({ message: "Validación fallida", errors });

    // Evitar duplicado por key
    const exists = await IamPermission.exists({ key: input.key });
    if (exists)
      return res
        .status(409)
        .json({ message: "Ya existe un permiso con esa key" });

    const doc = await IamPermission.create(input);

    await writeAudit(req, {
      action: "create",
      entity: "permission",
      entityId: doc._id.toString(),
      before: null,
      after: {
        key: doc.key,
        label: doc.label,
        group: doc.group,
        order: doc.order ?? 0,
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creando permiso", error: err.message });
  }
});

/**
 * PATCH /api/iam/v1/permissions/:id
 * Actualiza campos permitidos. Si cambia la key, la sincroniza en los roles.
 */
r.patch("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { id } = req.params;
    const update = pickUpdatable(req.body);

    if (update.key && !/^[a-z0-9_.-]+$/i.test(update.key)) {
      return res.status(400).json({
        message: "key solo puede contener letras, números, . _ -",
      });
    }

    const prev = await IamPermission.findById(id).lean();
    if (!prev) return res.status(404).json({ message: "No encontrado" });

    const doc = await IamPermission.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (update.key && update.key !== prev.key) {
      await IamRole.updateMany(
        { permissions: prev.key },
        { $set: { "permissions.$[elem]": update.key } },
        { arrayFilters: [{ elem: prev.key }] }
      );
    }

    await writeAudit(req, {
      action: "update",
      entity: "permission",
      entityId: id,
      before: {
        key: prev.key,
        label: prev.label,
        group: prev.group,
        order: prev.order ?? 0,
      },
      after: {
        key: doc.key,
        label: doc.label,
        group: doc.group,
        order: doc.order ?? 0,
      },
    });

    res.json(doc);
  } catch (err) {
    res.status(500).json({
      message: "Error actualizando permiso",
      error: err.message,
    });
  }
});

/**
 * DELETE /api/iam/v1/permissions/:id
 * Elimina un permiso por id y lo quita de los roles que lo tengan.
 */
r.delete("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { id } = req.params;

    const perm = await IamPermission.findById(id).lean();
    if (!perm) return res.status(404).json({ message: "No encontrado" });

    const del = await IamPermission.deleteOne({ _id: id });
    if (del.deletedCount === 0)
      return res.status(404).json({ message: "No encontrado" });

    await IamRole.updateMany(
      { permissions: perm.key },
      { $pull: { permissions: perm.key } }
    );

    await writeAudit(req, {
      action: "delete",
      entity: "permission",
      entityId: id,
      before: {
        key: perm.key,
        label: perm.label,
        group: perm.group,
        order: perm.order ?? 0,
      },
      after: null,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      message: "Error eliminando permiso",
      error: err.message,
    });
  }
});

/**
 * POST /api/iam/v1/permissions/sync
 * Siembra/sincroniza permisos desde el frontend de forma idempotente.
 * Body: { permissions: [{key,label,group,order?},...], dryRun?: boolean }
 */
r.post("/sync", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { permissions = [], dryRun = false } = req.body || {};

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        message: "permissions debe ser un arreglo no vacío",
      });
    }

    const map = new Map();
    const allErrors = [];

    for (const raw of permissions) {
      const p = normalizePerm(raw);
      const errs = validatePerm(p);
      if (errs.length) {
        allErrors.push({ key: raw?.key ?? "(sin key)", errors: errs });
        continue;
      }
      map.set(p.key, p);
    }

    if (allErrors.length) {
      return res.status(400).json({
        message: "Validación fallida en uno o más items",
        details: allErrors,
      });
    }

    const list = [...map.values()];

    if (dryRun) {
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

      return res.json({
        dryRun: true,
        totalReceived: list.length,
        wouldCreateCount: wouldCreate.length,
        wouldUpdateCount: wouldUpdate.length,
        wouldCreate,
        wouldUpdate,
      });
    }

    const existing = await IamPermission.find(
      { key: { $in: list.map((p) => p.key) } },
      { key: 1 }
    ).lean();
    const existSet = new Set(existing.map((e) => e.key));
    const willCreate = list
      .filter((p) => !existSet.has(p.key))
      .map((p) => p.key);
    const willUpdate = list
      .filter((p) => existSet.has(p.key))
      .map((p) => p.key);

    const ops = list.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: {
          $set: { label: p.label, group: p.group, order: p.order ?? 0 },
        },
        upsert: true,
      },
    }));

    const result = await IamPermission.bulkWrite(ops, { ordered: false });

    const created =
      (result.upsertedCount != null
        ? result.upsertedCount
        : Object.keys(result.upsertedIds || {}).length) || 0;
    const matched = result.matchedCount ?? result.nMatched ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    await writeAudit(req, {
      action: "update",
      entity: "permission",
      entityId: "bulk",
      before: null,
      after: {
        totalReceived: list.length,
        created,
        matched,
        modified,
        keysCreated: willCreate,
        keysUpdated: willUpdate,
      },
    });

    return res.json({
      ok: true,
      totalReceived: list.length,
      created,
      matched,
      modified,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error sincronizando permisos",
      error: err.message,
    });
  }
});

export default r;
