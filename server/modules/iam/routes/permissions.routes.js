// server/modules/iam/routes/permissions.routes.js
import { Router } from "express";
import IamPermission from "../models/IamPermission.model.js";
import { requirePerm, devOr } from "../utils/rbac.util.js";

const r = Router();

/* =========================
 * Helpers
 * =======================*/

/** Normaliza un permiso recibido desde el front */
function normalizePerm(p = {}) {
  const key = String(p.key ?? "").trim();
  const label = String(p.label ?? "").trim();
  const group = String(p.group ?? "").trim();
  const order = Number.isFinite(p.order) ? Number(p.order) : 0;
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

/** Sanitiza objetos para updates (whitelist) */
function pickUpdatable(body = {}) {
  const out = {};
  if (body.key != null) out.key = String(body.key).trim();
  if (body.label != null) out.label = String(body.label).trim();
  if (body.group != null) out.group = String(body.group).trim();
  if (body.order != null) out.order = Number(body.order) || 0;
  return out;
}

/* =========================
 * Rutas
 * =======================*/

/**
 * GET /api/iam/v1/permissions
 * Lista permisos. Soporta filtros básicos (?group=, ?q=).
 * Devuelve items y groups estructurados.
 */
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { group, q } = req.query;

    const filter = {};
    if (group) filter.group = String(group);
    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ key: rx }, { label: rx }, { group: rx }];
    }

    const docs = await IamPermission.find(filter)
      .sort({ group: 1, order: 1, key: 1 })
      .lean();

    // Estructura por grupo: [{ group: 'bitacora', items: [...] }, ...]
    const groupMap = new Map();
    for (const d of docs) {
      if (!groupMap.has(d.group)) groupMap.set(d.group, []);
      groupMap.get(d.group).push(d);
    }
    const groups = [...groupMap.entries()].map(([g, items]) => ({ group: g, items }));

    res.json({
      count: docs.length,
      groupsCount: groups.length,
      items: docs,
      groups,
    });
  } catch (err) {
    res.status(500).json({ message: "Error listando permisos", error: err.message });
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
    if (errors.length) return res.status(400).json({ message: "Validación fallida", errors });

    // Evitar duplicado por key
    const exists = await IamPermission.exists({ key: input.key });
    if (exists) return res.status(409).json({ message: "Ya existe un permiso con esa key" });

    const doc = await IamPermission.create(input);
    res.status(201).json(doc);
  } catch (err) {
    // índice único o validación de mongoose
    res.status(500).json({ message: "Error creando permiso", error: err.message });
  }
});

/**
 * PATCH /api/iam/v1/permissions/:id
 * Actualiza campos permitidos.
 */
r.patch("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { id } = req.params;
    const update = pickUpdatable(req.body);

    // Si cambia key, valida formato
    if (update.key && !/^[a-z0-9_.-]+$/i.test(update.key)) {
      return res.status(400).json({ message: "key solo puede contener letras, números, . _ -" });
    }

    const doc = await IamPermission.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!doc) return res.status(404).json({ message: "No encontrado" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Error actualizando permiso", error: err.message });
  }
});

/**
 * DELETE /api/iam/v1/permissions/:id
 * Elimina un permiso por id.
 */
r.delete("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { id } = req.params;
    const del = await IamPermission.deleteOne({ _id: id });
    if (del.deletedCount === 0) return res.status(404).json({ message: "No encontrado" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Error eliminando permiso", error: err.message });
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
      return res.status(400).json({ message: "permissions debe ser un arreglo no vacío" });
    }

    // Normaliza, valida y deduplica por key (último gana)
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
      return res.status(400).json({ message: "Validación fallida en uno o más items", details: allErrors });
    }

    const list = [...map.values()];

    if (dryRun) {
      // Reporta qué se crearía
      const existing = await IamPermission.find(
        { key: { $in: list.map(p => p.key) } },
        { key: 1 }
      ).lean();

      const existSet = new Set(existing.map(e => e.key));
      const wouldCreate = list.filter(p => !existSet.has(p.key)).map(p => p.key);
      const wouldUpdate = list.filter(p => existSet.has(p.key)).map(p => p.key);

      return res.json({
        dryRun: true,
        totalReceived: list.length,
        wouldCreateCount: wouldCreate.length,
        wouldUpdateCount: wouldUpdate.length,
        wouldCreate,
        wouldUpdate,
      });
    }

    // bulkWrite idempotente
    const ops = list.map(p => ({
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
      (result.upsertedCount != null ? result.upsertedCount : Object.keys(result.upsertedIds || {}).length) || 0;
    const matched = result.matchedCount ?? result.nMatched ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    return res.json({
      ok: true,
      totalReceived: list.length,
      created,
      matched,
      modified,
    });
  } catch (err) {
    res.status(500).json({ message: "Error sincronizando permisos", error: err.message });
  }
});

export default r;
