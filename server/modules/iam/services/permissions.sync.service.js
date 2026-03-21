// server/modules/iam/services/permissions.sync.service.js
import IamPermission from "../models/IamPermission.model.js";
import IamRole from "../models/IamRole.model.js";
import {
  permisosCanonicos,
  normalizePermissionKey,
  getPermissionLabel,
} from "../catalogs/perms.catalog.js";

/* ==================================================
   Aliases legacy -> canónico
   ================================================== */
const LEGACY_PERMISSION_ALIASES = {
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

function canonicalKey(key) {
  const normalized = normalizePermissionKey(key);
  if (!normalized) return "";
  return LEGACY_PERMISSION_ALIASES[normalized] || normalized;
}

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

  const resourceWeight = {
    users: 10,
    roles: 20,
    audit: 30,
    permissions: 40,

    assignments: 100,
    alerts: 105,
    incidents: 108,
    qr: 110,
    checkpoints: 120,
    points: 125,
    sites: 130,
    rounds: 140,
    reports: 150,
    scan: 160,
    checks: 170,
    panic: 180,
    offline: 190,

    records: 200,
    evidences: 210,
    vehiculos: 220,
    catalogs: 230,
    catalogsread: 231,

    dashboard: 300,
    exports: 310,
  };

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
  const normalizedKey = canonicalKey(key);

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

async function migrateLegacyPermissionIfExists(canonical, logger = console) {
  const legacyKeys = Object.entries(LEGACY_PERMISSION_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([legacy]) => legacy);

  if (legacyKeys.length === 0) return { migrated: false };

  const existingLegacy = await IamPermission.findOne({
    key: { $in: legacyKeys },
  }).lean();

  if (!existingLegacy) return { migrated: false };

  const targetExists = await IamPermission.findOne({ key: canonical }).lean();

  if (targetExists) {
    await replacePermissionKeyInRoles(existingLegacy.key, canonical);
    await IamPermission.deleteOne({ _id: existingLegacy._id });

    logger?.warn?.(
      `[permissions.sync] legacy eliminado por duplicado: ${existingLegacy.key} -> ${canonical}`
    );

    return {
      migrated: true,
      from: existingLegacy.key,
      to: canonical,
      removedLegacy: true,
    };
  }

  const doc = buildPermissionDoc(canonical, existingLegacy.label);

  await IamPermission.updateOne(
    { _id: existingLegacy._id },
    {
      $set: {
        key: doc.key,
        label: doc.label,
        group: doc.group,
        order: doc.order,
      },
    }
  );

  await replacePermissionKeyInRoles(existingLegacy.key, canonical);

  logger?.info?.(
    `[permissions.sync] legacy migrado: ${existingLegacy.key} -> ${canonical}`
  );

  return {
    migrated: true,
    from: existingLegacy.key,
    to: canonical,
    removedLegacy: false,
  };
}

/* ==================================================
   Sync principal
   - Usa SOLO permisos canónicos como fuente maestra
   - Migra aliases legacy si existen
   - NO elimina permisos faltantes
   - Actualiza key/label/group/order
   ================================================== */
export async function syncPermissionsCatalog(options = {}) {
  const { logger = console } = options || {};

  const canonicalEntriesMap = new Map();

  for (const [rawKey, rawLabel] of Object.entries(permisosCanonicos || {})) {
    const key = canonicalKey(rawKey);
    if (!key) continue;

    if (!canonicalEntriesMap.has(key)) {
      canonicalEntriesMap.set(key, rawLabel);
    }
  }

  const entries = [...canonicalEntriesMap.entries()];

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let migrated = 0;
  const errors = [];
  const migrations = [];

  for (const [rawKey, rawLabel] of entries) {
    try {
      const normalizedKey = canonicalKey(rawKey);
      if (!normalizedKey) continue;

      const migration = await migrateLegacyPermissionIfExists(normalizedKey, logger);
      if (migration?.migrated) {
        migrated += 1;
        migrations.push(migration);
      }

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
    migrated,
    migrations,
    errors,
  };
}

/* ==================================================
   Listado catálogo normalizado para UI / controllers
   ================================================== */
export function listCatalogPermissions() {
  const map = new Map();

  for (const [key, label] of Object.entries(permisosCanonicos || {})) {
    const doc = buildPermissionDoc(key, label);
    if (!doc.key) continue;
    map.set(doc.key, doc);
  }

  return sortPermissionDocs([...map.values()]);
}

/* ==================================================
   Buscar permiso puntual del catálogo
   ================================================== */
export function getCatalogPermissionByKey(key) {
  const normalizedKey = canonicalKey(key);
  if (!normalizedKey) return null;

  const label =
    permisosCanonicos[normalizedKey] ||
    permisosCanonicos[normalizePermissionKey(key)] ||
    getPermissionLabel(normalizedKey);

  if (!label) return null;

  return buildPermissionDoc(normalizedKey, label);
}

/* ==================================================
   Asegura que una lista de keys exista en BD
   ================================================== */
export async function ensurePermissionsExist(keys = []) {
  const normalizedKeys = Array.isArray(keys)
    ? [...new Set(keys.map((k) => canonicalKey(k)).filter(Boolean))]
    : [];

  const results = {
    created: 0,
    existing: 0,
    migrated: 0,
    missingInCatalog: [],
  };

  for (const rawKey of normalizedKeys) {
    const key = canonicalKey(rawKey);
    if (!key) continue;

    const label = permisosCanonicos[key] || getPermissionLabel(key);

    if (!permisosCanonicos[key]) {
      results.missingInCatalog.push(key);
      continue;
    }

    const migration = await migrateLegacyPermissionIfExists(key);
    if (migration?.migrated) {
      results.migrated += 1;
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