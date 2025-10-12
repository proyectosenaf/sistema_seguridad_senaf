// server/modules/iam/utils/seed.util.js
import * as XLSX from "xlsx";
import IamPermission from "../models/IamPermission.model.js";
import IamRole from "../models/IamRole.model.js";

/** Normaliza cadenas a una "clave" de permiso */
function norm(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")                       // separa por puntos
    .replace(/\.+/g, ".")                               // colapsa puntos
    .replace(/^\.|\.$/g, "");                           // quita punto inicial/final
}

/** Convierte texto a clave: "Clientes", "Editar Básico" -> "clientes.editar.basico" */
export function toKey(group, label) {
  return `${norm(group)}.${norm(label)}`;
}

/** ¿La celda parece un encabezado de módulo? (fila en MAYÚSCULAS) */
function isHeader(v) {
  if (!v) return false;
  const s = String(v).trim();
  if (!s) return false;
  // Si no cambia al pasarlo a upper, lo tratamos como encabezado
  return s === s.toUpperCase();
}

/**
 * Parsea Excel tipo “módulos y permisos” (primera hoja):
 * Columna 1 = etiqueta (encabezado de módulo en MAYÚSCULAS o item con •/guion).
 * Siguientes columnas = nombres de roles; ✔/✓/X/si/true = marcado.
 */
export function parseExcelRolesPermissions(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return { permissions: [], roles: {} };

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rows.length) return { permissions: [], roles: {} };

  const firstKey = Object.keys(rows[0])[0];     // primera columna = feature/etiqueta
  const roleCols = Object.keys(rows[0]).slice(1);

  // Catálogo de permisos y asignación por rol
  let currentModule = null;
  const permsCatalog = [];                      // [{ key, label, group, order }]
  const roleToKeys = Object.fromEntries(roleCols.map(r => [String(r).trim(), new Set()]));

  let order = 0;

  for (const row of rows) {
    const raw = String(row[firstKey] ?? "").trim();
    if (!raw) continue;

    if (isHeader(raw)) {
      currentModule = raw.trim();
      continue;
    }

    // limpia viñetas tipo "- ", "• ", "· "
    const label = raw.replace(/^[-•·]\s*/, "").trim();
    const group = currentModule || "General";
    const key = toKey(group, label);

    permsCatalog.push({ key, label, group, order: order++ });

    // marcar roles
    for (const col of roleCols) {
      const roleName = String(col).trim();
      const v = String(row[col] ?? "").toLowerCase();

      const checked = ["✓", "✔", "x", "si", "sí", "true", "1", "ok", "check"]
        .some(t => v.includes(t));
      if (checked) roleToKeys[roleName].add(key);
    }
  }

  // Convertir sets a arrays
  const roles = {};
  for (const [role, set] of Object.entries(roleToKeys)) {
    roles[role] = [...set];
  }

  return { permissions: permsCatalog, roles };
}

/** Inserta/actualiza en BD (idempotente) */
export async function seedFromParsed({ permissions = [], roles = {} }) {
  // Permisos
  for (const p of permissions) {
    const label = String(p.label ?? "").trim();
    const group = String(p.group ?? "").trim();
    const key   = String(p.key   ?? "").trim();
    if (!key || !label || !group) continue;

    await IamPermission.updateOne(
      { key },
      { $set: { label, group, order: Number.isFinite(p.order) ? p.order : 0 } },
      { upsert: true }
    );
  }

  // Roles
  for (const [roleNameRaw, keysRaw] of Object.entries(roles)) {
    const roleName = String(roleNameRaw ?? "").trim();
    if (!roleName) continue;

    const code = norm(roleName).replace(/\./g, "_");  // p.ej. "manager_general"
    const permissions = (Array.isArray(keysRaw) ? keysRaw : []).map(k => String(k).trim()).filter(Boolean);

    await IamRole.updateOne(
      { code },
      {
        $setOnInsert: { code },
        $set: {
          name: roleName,
          description: roleName,
          permissions,
        },
      },
      { upsert: true }
    );
  }
}
