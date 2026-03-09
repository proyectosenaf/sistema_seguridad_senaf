// server/modules/iam/services/permissions.sync.service.js
import IamPermission from "../models/IamPermission.model.js";
import {
  permisosCanonicos,
  normalizePermissionKey,
  getPermissionLabel,
} from "../catalogs/perms.catalog.js";

/* ==================================================
   Helpers
   ================================================== */

function inferGroupFromKey(key) {
  const k = String(key || "").trim().toLowerCase();
  return k.split(".")[0] || "general";
}

function buildOrderFromKey(key) {
  const parts = String(key || "").trim().toLowerCase().split(".");
  const resource = parts[1] || "";
  const action = parts[2] || "";

  // Orden base por recurso
  const resourceWeight = {
    users: 10,
    roles: 20,
    audit: 30,

    assignments: 100,
    qr: 110,
    checkpoints: 120,
    sites: 130,
    rounds: 140,
    reports: 150,
    scan: 160,
    checks: 170,
    panic: 180,
    offline: 190,

    records: 200,
    evidences: 210,

    dashboard: 300,
    exports: 310,
  };

  // Orden fino por acción
  const actionWeight = {
    read: 1,
    write: 2,
    delete: 3,
    close: 4,
    export: 5,
    query: 6,
    highlight: 7,
    print: 8,
    map: 9,
    generate: 10,
    execute: 11,
    manual: 12,
  };

  const rw = resourceWeight[resource] ?? 900;
  const aw = actionWeight[action] ?? 0;

  return rw + aw;
}

function buildPermissionDoc(key, label) {
  const normalizedKey = normalizePermissionKey(key);

  return {
    key: normalizedKey,
    label: String(label || "").trim() || getPermissionLabel(normalizedKey),
    group: inferGroupFromKey(normalizedKey),
    order: buildOrderFromKey(normalizedKey),
  };
}

function sortPermissionDocs(items = []) {
  return [...items].sort((a, b) => {
    const ag = String(a?.group || "").localeCompare(String(b?.group || ""));
    if (ag !== 0) return ag;

    const ao = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
    const bo = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;
    if (ao !== bo) return ao - bo;

    return String(a?.key || "").localeCompare(String(b?.key || ""));
  });
}

/* ==================================================
   Sync principal
   - Usa SOLO permisos canónicos como fuente maestra
   - NO elimina permisos faltantes
   - Actualiza key/label/group/order
   ================================================== */
export async function syncPermissionsCatalog(options = {}) {
  const { logger = console } = options || {};

  const entries = Object.entries(permisosCanonicos || {});
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const errors = [];

  for (const [rawKey, rawLabel] of entries) {
    try {
      const normalizedKey = normalizePermissionKey(rawKey);
      if (!normalizedKey) continue;

      const doc = buildPermissionDoc(normalizedKey, rawLabel);

      const existing = await IamPermission.findOne({ key: normalizedKey }).lean();

      if (!existing) {
        await IamPermission.create(doc);
        created += 1;
        continue;
      }

      const needsUpdate =
        String(existing.label || "") !== String(doc.label || "") ||
        String(existing.group || "") !== String(doc.group || "") ||
        Number(existing.order || 0) !== Number(doc.order || 0);

      if (needsUpdate) {
        await IamPermission.updateOne(
          { _id: existing._id },
          {
            $set: {
              label: doc.label,
              group: doc.group,
              order: doc.order,
            },
          }
        );
        updated += 1;
      } else {
        unchanged += 1;
      }
    } catch (err) {
      errors.push({
        key: rawKey,
        error: err?.message || String(err),
      });
      logger?.error?.("[permissions.sync] error syncing key:", rawKey, err);
    }
  }

  return {
    ok: errors.length === 0,
    totalCatalog: entries.length,
    created,
    updated,
    unchanged,
    errors,
  };
}

/* ==================================================
   Listado catálogo normalizado para UI / controllers
   ================================================== */
export function listCatalogPermissions() {
  const items = Object.entries(permisosCanonicos).map(([key, label]) =>
    buildPermissionDoc(key, label)
  );

  return sortPermissionDocs(items);
}

/* ==================================================
   Buscar permiso puntual del catálogo
   ================================================== */
export function getCatalogPermissionByKey(key) {
  const normalizedKey = normalizePermissionKey(key);
  if (!normalizedKey) return null;

  const label = permisosCanonicos[normalizedKey];
  if (!label) return null;

  return buildPermissionDoc(normalizedKey, label);
}

/* ==================================================
   Asegura que una lista de keys exista en BD
   Útil cuando quieras sembrar permisos puntuales
   ================================================== */
export async function ensurePermissionsExist(keys = []) {
  const normalizedKeys = Array.isArray(keys)
    ? [...new Set(keys.map((k) => normalizePermissionKey(k)).filter(Boolean))]
    : [];

  const results = {
    created: 0,
    existing: 0,
    missingInCatalog: [],
  };

  for (const rawKey of normalizedKeys) {
    const key = normalizePermissionKey(rawKey);
    if (!key) continue;

    const label = permisosCanonicos[key] || getPermissionLabel(key);
    if (!permisosCanonicos[key]) {
      results.missingInCatalog.push(key);
      continue;
    }

    const exists = await IamPermission.exists({ key });
    if (exists) {
      results.existing += 1;
      continue;
    }

    await IamPermission.create(buildPermissionDoc(key, label));
    results.created += 1;
  }

  return results;
}

export default {
  syncPermissionsCatalog,
  listCatalogPermissions,
  getCatalogPermissionByKey,
  ensurePermissionsExist,
};