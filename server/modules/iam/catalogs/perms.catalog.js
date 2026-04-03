// server/modules/iam/catalogs/perms.catalog.js

/* ==================================================
   1) PERMISOS CANÓNICOS
   ================================================== */
export const permisosCanonicos = {
  // ======================
  // IAM
  // ======================
  "iam.users.read": "Usuarios y Roles • Ver usuarios",
  "iam.users.write": "Usuarios y Roles • Gestionar usuarios",
  "iam.roles.read": "Usuarios y Roles • Ver roles",
  "iam.roles.write": "Usuarios y Roles • Gestionar roles",
  "iam.audit.read": "Usuarios y Roles • Ver historial (audit)",
  "iam.permissions.manage": "Usuarios y Roles • Gestionar permisos",

  // ======================
  // SYSTEM / RESPALDO Y RESTAURACIÓN
  // ======================
  "system.backups.read": "Respaldo y Restauración • Ver respaldos",
  "system.backups.create": "Respaldo y Restauración • Generar respaldos",
  "system.backups.restore": "Respaldo y Restauración • Restaurar respaldos",
  "system.backups.download": "Respaldo y Restauración • Descargar respaldos",
  "system.backups.delete": "Respaldo y Restauración • Eliminar respaldos",
  "system.backups.schedule": "Respaldo y Restauración • Gestionar programación de respaldos",

  // ======================
  // RONDAS QR
  // ======================
  "rondasqr.assignments.read": "Rondas QR • Asignaciones (ver)",
  "rondasqr.assignments.write": "Rondas QR • Asignaciones (crear/editar)",
  "rondasqr.assignments.delete": "Rondas QR • Asignaciones (eliminar)",

  "rondasqr.qr.read": "Rondas QR • Repositorio de códigos QR (ver)",
  "rondasqr.qr.generate": "Rondas QR • Generar códigos QR",
  "rondasqr.qr.export": "Rondas QR • Exportar/descargar códigos QR",

  "rondasqr.checkpoints.read": "Rondas QR • Puntos de control (ver)",
  "rondasqr.checkpoints.write":
    "Rondas QR • Puntos de control (crear/editar/eliminar)",

  "rondasqr.points.read": "Rondas QR • Puntos (ver)",
  "rondasqr.points.write": "Rondas QR • Puntos (crear/editar/reordenar)",
  "rondasqr.points.delete": "Rondas QR • Puntos (eliminar)",

  "rondasqr.sites.read": "Rondas QR • Ciudades/Sitios (ver)",
  "rondasqr.sites.write": "Rondas QR • Ciudades/Sitios (crear/editar/eliminar)",

  "rondasqr.rounds.read": "Rondas QR • Rondas (ver)",
  "rondasqr.rounds.write": "Rondas QR • Rondas (crear/editar/eliminar)",

  "rondasqr.reports.read": "Rondas QR • Ver informes",
  "rondasqr.reports.query": "Rondas QR • Consultar (filtros)",
  "rondasqr.reports.highlight": "Rondas QR • Destacados",
  "rondasqr.reports.export": "Rondas QR • Exportar informes",
  "rondasqr.reports.print": "Rondas QR • Imprimir informes",
  "rondasqr.reports.map": "Rondas QR • Ver mapa en informes",

  "rondasqr.scan.execute": "Rondas QR • Escanear/registrar punto",
  "rondasqr.scan.manual": "Rondas QR • Registrar punto manual",

  "rondasqr.checks.write": "Rondas QR • Marcar/corregir check",

  "rondasqr.panic.write": "Rondas QR • Enviar alerta de pánico",
  "rondasqr.panic.read": "Rondas QR • Ver alertas de pánico",

  "rondasqr.alerts.read": "Rondas QR • Ver alertas",
  "rondasqr.alerts.write": "Rondas QR • Crear alertas",

  "rondasqr.incidents.read": "Rondas QR • Ver incidentes rápidos",
  "rondasqr.incidents.write": "Rondas QR • Crear incidentes rápidos",
  "rondasqr.incidents.delete": "Rondas QR • Eliminar incidentes rápidos",

  "rondasqr.offline.read": "Rondas QR • Ver/usar modo offline",
  "rondasqr.offline.write": "Rondas QR • Enviar/descargar base offline",

  // ======================
  // INCIDENTES
  // ======================
  "incidentes.records.read": "Incidentes • Ver lista/detalle",
  "incidentes.records.write": "Incidentes • Crear/Editar",
  "incidentes.records.delete": "Incidentes • Eliminar",
  "incidentes.records.close": "Incidentes • Cerrar/Aprobar",
  "incidentes.evidences.write": "Incidentes • Adjuntar evidencias",
  "incidentes.reports.read": "Incidentes • Ver reportes",
  "incidentes.reports.export": "Incidentes • Exportar reportes",

  // Compatibilidad de alcance global
  "incidentes.read.any": "Incidentes • Ver todo",
  "incidentes.reports.any": "Incidentes • Ver reportes globales",
  "incidentes.create.any": "Incidentes • Crear global",
  "incidentes.edit.any": "Incidentes • Editar global",
  "incidentes.delete.any": "Incidentes • Eliminar global",

  // ======================
  // ACCESOS
  // ======================
  "accesos.records.read": "Control de Acceso • Ver",
  "accesos.records.write": "Control de Acceso • Registrar/Editar",
  "accesos.records.delete": "Control de Acceso • Eliminar",
  "accesos.records.close": "Control de Acceso • Aprobar/Cerrar",
  "accesos.reports.read": "Control de Acceso • Ver reportes",
  "accesos.reports.export": "Control de Acceso • Exportar reportes",
  "accesos.catalogs.read": "Control de Acceso • Ver catálogos",

  // ======================
  // VISITAS
  // ======================
  "visitas.records.read": "Control de Visitas • Ver",
  "visitas.records.write": "Control de Visitas • Registrar/Editar",
  "visitas.records.delete": "Control de Visitas • Eliminar",
  "visitas.records.close": "Control de Visitas • Aprobar/Cerrar",
  "visitas.reports.read": "Control de Visitas • Ver reportes",
  "visitas.reports.export": "Control de Visitas • Exportar reportes",
  "visitas.qr.scan": "Control de Visitas • Escanear QR",
  "visitas.vehiculos.read": "Control de Visitas • Ver vehículos en sitio",

  // ======================
  // CITAS (NUEVO PARA UI)
  // ======================
  "visitas.citas.read": "Control de Visitas • Citas (ver)",
  "visitas.citas.write": "Control de Visitas • Citas (crear/editar)",
  "visitas.citas.checkin": "Control de Visitas • Citas (check-in)",
  "visitas.citas.estado": "Control de Visitas • Citas (cambiar estado)",

  // ======================
  // BITÁCORA
  // ======================
  "bitacora.visualizar": "Bitácora • Visualizar",
  "bitacora.records.read": "Bitácora • Ver registros",
  "bitacora.records.write": "Bitácora • Registrar/Restaurar",
  "bitacora.records.delete": "Bitácora • Eliminar",
  "bitacora.reports.export": "Bitácora • Exportar reportes",

  // ======================
  // REPORTES GENERALES
  // ======================
  "reportes.dashboard.read": "Reportes • Ver dashboard",
  "reportes.exports.export": "Reportes • Exportar",
};

/* ==================================================
   2) ALIASES LEGACY -> CANÓNICO
   ================================================== */
export const LEGACY_PERMISSION_ALIASES = {
  // IAM
  "iam.users.view": "iam.users.read",
  "iam.users.manage": "iam.users.write",
  "iam.roles.view": "iam.roles.read",
  "iam.roles.manage": "iam.roles.write",
  "iam.audit.view": "iam.audit.read",

  // System / Backups legacy
  "system.backups.view": "system.backups.read",
  "system.backups.manage": "system.backups.create",
  "system.backups.remove": "system.backups.delete",

  // Rondas QR legacy
  "rondasqr.view": "rondasqr.rounds.read",
  "rondasqr.create": "rondasqr.assignments.write",
  "rondasqr.edit": "rondasqr.assignments.write",
  "rondasqr.delete": "rondasqr.assignments.delete",
  "rondasqr.export": "rondasqr.reports.export",
  "rondasqr.reports": "rondasqr.reports.read",

  "rondasqr.qr.repo.read": "rondasqr.qr.read",
  "rondasqr.reports.view": "rondasqr.reports.read",
  "rondasqr.reports.export_pdf": "rondasqr.reports.export",
  "rondasqr.scan.qr": "rondasqr.scan.execute",
  "rondasqr.checks.create": "rondasqr.checks.write",
  "rondasqr.checks.update": "rondasqr.checks.write",
  "rondasqr.panic.send": "rondasqr.panic.write",
  "rondasqr.offline.use": "rondasqr.offline.read",
  "rondasqr.offline.dump": "rondasqr.offline.write",

  // Incidentes
  "incidentes.read": "incidentes.records.read",
  "incidentes.create": "incidentes.records.write",
  "incidentes.edit": "incidentes.records.write",
  "incidentes.delete": "incidentes.records.delete",
  "incidentes.close": "incidentes.records.close",
  "incidentes.attach": "incidentes.evidences.write",
  "incidentes.reports": "incidentes.reports.read",
  "incidentes.export": "incidentes.reports.export",

  // Accesos
  "accesos.read": "accesos.records.read",
  "accesos.write": "accesos.records.write",
  "accesos.delete": "accesos.records.delete",
  "accesos.export": "accesos.reports.export",

  // Visitas
  "visitas.read": "visitas.records.read",
  "visitas.write": "visitas.records.write",
  "visitas.delete": "visitas.records.delete",
  "visitas.close": "visitas.records.close",
  "visitas.export": "visitas.reports.export",

  // Bitácora
  "bitacora.read": "bitacora.records.read",
  "bitacora.write": "bitacora.records.write",
  "bitacora.delete": "bitacora.records.delete",
  "bitacora.export": "bitacora.reports.export",

  // Reportes generales
  "reportes.read": "reportes.dashboard.read",
  "reportes.export": "reportes.exports.export",
};

/* ==================================================
   3) CATÁLOGO LEGACY VISIBLE
   ================================================== */
export const permisosKeys = {
  // IAM
  "iam.users.view": "Usuarios y Roles • Ver usuarios",
  "iam.users.manage": "Usuarios y Roles • Gestionar usuarios",
  "iam.roles.manage": "Usuarios y Roles • Gestionar roles",
  "iam.audit.view": "Usuarios y Roles • Ver historial (audit)",

  // System / Backups legacy / compat
  "system.backups.view": "Respaldo y Restauración • Ver respaldos",
  "system.backups.manage": "Respaldo y Restauración • Generar respaldos",
  "system.backups.read": "Respaldo y Restauración • Ver respaldos",
  "system.backups.create": "Respaldo y Restauración • Generar respaldos",
  "system.backups.restore": "Respaldo y Restauración • Restaurar respaldos",
  "system.backups.download": "Respaldo y Restauración • Descargar respaldos",
  "system.backups.delete": "Respaldo y Restauración • Eliminar respaldos",
  "system.backups.schedule": "Respaldo y Restauración • Gestionar programación de respaldos",

  // Rondas QR legacy / compat
  "rondasqr.view": "Rondas QR • Ver lista/detalle",
  "rondasqr.create": "Rondas QR • Crear/Asignar",
  "rondasqr.edit": "Rondas QR • Editar",
  "rondasqr.delete": "Rondas QR • Eliminar",
  "rondasqr.export": "Rondas QR • Exportar",
  "rondasqr.reports": "Rondas QR • Ver reportes",

  "rondasqr.assignments.read": "Rondas QR • Asignaciones (ver)",
  "rondasqr.assignments.write": "Rondas QR • Asignaciones (crear/editar)",
  "rondasqr.assignments.delete": "Rondas QR • Asignaciones (eliminar)",

  "rondasqr.qr.generate": "Rondas QR • Generar códigos QR",
  "rondasqr.qr.repo.read": "Rondas QR • Repositorio de códigos QR (ver)",
  "rondasqr.qr.export": "Rondas QR • Exportar/descargar códigos QR",

  "rondasqr.checkpoints.read": "Rondas QR • Puntos de control (ver)",
  "rondasqr.checkpoints.write":
    "Rondas QR • Puntos de control (crear/editar/eliminar)",

  "rondasqr.points.read": "Rondas QR • Puntos (ver)",
  "rondasqr.points.write": "Rondas QR • Puntos (crear/editar/reordenar)",
  "rondasqr.points.delete": "Rondas QR • Puntos (eliminar)",

  "rondasqr.sites.read": "Rondas QR • Ciudades (ver)",
  "rondasqr.sites.write": "Rondas QR • Ciudades (crear/editar/eliminar)",

  "rondasqr.rounds.read": "Rondas QR • Rondas (ver)",
  "rondasqr.rounds.write": "Rondas QR • Rondas (crear/editar/eliminar)",

  "rondasqr.reports.view": "Rondas QR • Ver informes",
  "rondasqr.reports.query": "Rondas QR • Consultar (filtros)",
  "rondasqr.reports.highlight": "Rondas QR • Destacados",
  "rondasqr.reports.export_pdf": "Rondas QR • Exportar PDF",
  "rondasqr.reports.print": "Rondas QR • Imprimir",
  "rondasqr.reports.map": "Rondas QR • Ver mapa en informes",

  "rondasqr.scan.qr": "Rondas QR • Escanear QR",
  "rondasqr.scan.manual": "Rondas QR • Registrar punto manual",

  "rondasqr.checks.create": "Rondas QR • Marcar punto (check)",
  "rondasqr.checks.update": "Rondas QR • Corregir/editar check",

  "rondasqr.panic.send": "Rondas QR • Enviar alerta de pánico",
  "rondasqr.panic.read": "Rondas QR • Ver alertas de pánico",

  "rondasqr.alerts.read": "Rondas QR • Ver alertas",
  "rondasqr.alerts.write": "Rondas QR • Crear alertas",

  "rondasqr.incidents.read": "Rondas QR • Ver incidentes rápidos",
  "rondasqr.incidents.write": "Rondas QR • Crear incidentes rápidos",
  "rondasqr.incidents.delete": "Rondas QR • Eliminar incidentes rápidos",

  "rondasqr.offline.use": "Rondas QR • Trabajar sin conexión",
  "rondasqr.offline.dump": "Rondas QR • Enviar/descargar base offline",

  // Incidentes
  "incidentes.read": "Incidentes • Ver lista/detalle",
  "incidentes.create": "Incidentes • Crear",
  "incidentes.edit": "Incidentes • Editar",
  "incidentes.delete": "Incidentes • Eliminar",
  "incidentes.close": "Incidentes • Cerrar/Aprobar",
  "incidentes.export": "Incidentes • Exportar",
  "incidentes.reports": "Incidentes • Ver reportes",
  "incidentes.attach": "Incidentes • Adjuntar evidencias",

  // Accesos
  "accesos.read": "Control de Acceso • Ver",
  "accesos.write": "Control de Acceso • Registrar/Editar",
  "accesos.delete": "Control de Acceso • Eliminar",
  "accesos.export": "Control de Acceso • Exportar",

  // Visitas
  "visitas.read": "Control de Visitas • Ver",
  "visitas.write": "Control de Visitas • Registrar/Editar",
  "visitas.delete": "Control de Visitas • Eliminar",
  "visitas.close": "Control de Visitas • Aprobar/Cerrar",
  "visitas.export": "Control de Visitas • Exportar",

  // Citas (nuevo visible en UI)
  "visitas.citas.read": "Control de Visitas • Citas (ver)",
  "visitas.citas.write": "Control de Visitas • Citas (crear/editar)",
  "visitas.citas.checkin": "Control de Visitas • Citas (check-in)",
  "visitas.citas.estado": "Control de Visitas • Citas (cambiar estado)",

  // Bitácora
  "bitacora.read": "Bitácora • Ver",
  "bitacora.write": "Bitácora • Registrar",
  "bitacora.delete": "Bitácora • Eliminar",
  "bitacora.export": "Bitácora • Exportar",

  // Reportes
  "reportes.read": "Reportes • Ver",
  "reportes.export": "Reportes • Exportar",
};

/* ==================================================
   4) CATÁLOGO NORMALIZADO
   ================================================== */
export const permisosKeysNormalized = { ...permisosCanonicos };

/* ==================================================
   5) HELPERS DE NORMALIZACIÓN
   ================================================== */
export function normalizePermissionKey(key) {
  const k = String(key || "").trim().toLowerCase();
  if (!k) return "";
  return LEGACY_PERMISSION_ALIASES[k] || k;
}

export function normalizePermissionsList(list = []) {
  const arr = Array.isArray(list) ? list : [list];
  const out = arr
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .map(normalizePermissionKey);

  return [...new Set(out)];
}

export function denormalizePermissionKey(key) {
  const normalized = normalizePermissionKey(key);
  const legacy = Object.entries(LEGACY_PERMISSION_ALIASES).find(
    ([, canon]) => canon === normalized
  )?.[0];
  return legacy || normalized;
}

export function getPermissionLabel(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";

  return (
    permisosCanonicos[normalizePermissionKey(raw)] ||
    permisosCanonicos[raw] ||
    permisosKeys[raw] ||
    raw
  );
}

export function hasPermission(userPerms = [], required) {
  const perms = normalizePermissionsList(userPerms);
  const needed = normalizePermissionKey(required);

  if (perms.includes("*")) return true;
  return perms.includes(needed);
}

/* ==================================================
   6) TODAS LAS KEYS
   ================================================== */
const ALL_PERMISSION_KEYS = Object.keys(permisosKeys);
const ALL_NORMALIZED_PERMISSION_KEYS = Object.keys(permisosCanonicos);

/* ==================================================
   7) ROLES LEGACY/COMPAT
   ================================================== */
export const rolesKeys = {
  administrador: [...ALL_PERMISSION_KEYS],

  supervisor: [
    "iam.users.view",
    "iam.audit.view",

    "system.backups.view",
    "system.backups.download",

    "rondasqr.view",
    "rondasqr.create",
    "rondasqr.edit",
    "rondasqr.export",
    "rondasqr.reports",

    "rondasqr.assignments.read",
    "rondasqr.assignments.write",
    "rondasqr.qr.generate",
    "rondasqr.qr.repo.read",
    "rondasqr.qr.export",
    "rondasqr.checkpoints.read",
    "rondasqr.checkpoints.write",
    "rondasqr.points.read",
    "rondasqr.points.write",
    "rondasqr.points.delete",
    "rondasqr.sites.read",
    "rondasqr.sites.write",
    "rondasqr.rounds.read",
    "rondasqr.rounds.write",
    "rondasqr.reports.view",
    "rondasqr.reports.query",
    "rondasqr.reports.highlight",
    "rondasqr.reports.export_pdf",
    "rondasqr.reports.print",
    "rondasqr.reports.map",
    "rondasqr.scan.qr",
    "rondasqr.scan.manual",
    "rondasqr.checks.create",
    "rondasqr.checks.update",
    "rondasqr.panic.send",
    "rondasqr.panic.read",
    "rondasqr.alerts.read",
    "rondasqr.alerts.write",
    "rondasqr.incidents.read",
    "rondasqr.incidents.write",
    "rondasqr.offline.use",
    "rondasqr.offline.dump",

    "incidentes.read",
    "incidentes.create",
    "incidentes.edit",
    "incidentes.delete",
    "incidentes.close",
    "incidentes.export",
    "incidentes.reports",
    "incidentes.attach",
    "incidentes.read.any",
    "incidentes.reports.any",
    "incidentes.create.any",
    "incidentes.edit.any",
    "incidentes.delete.any",

    "accesos.read",
    "accesos.write",
    "accesos.delete",
    "accesos.export",

    "visitas.read",
    "visitas.write",
    "visitas.delete",
    "visitas.close",
    "visitas.export",
    "visitas.citas.read",
    "visitas.citas.write",
    "visitas.citas.checkin",
    "visitas.citas.estado",

    "bitacora.read",
    "bitacora.write",
    "bitacora.delete",
    "bitacora.export",

    "reportes.read",
    "reportes.export",
  ],

  guardia: [
    "rondasqr.view",
    "rondasqr.create",
    "rondasqr.edit",

    "rondasqr.scan.qr",
    "rondasqr.scan.manual",
    "rondasqr.checks.create",
    "rondasqr.offline.use",
    "rondasqr.panic.send",
    "rondasqr.panic.read",
    "rondasqr.incidents.write",
    "rondasqr.alerts.write",

    "incidentes.read",
    "incidentes.create",
    "incidentes.edit",
    "incidentes.attach",

    "visitas.write",
    "visitas.close",
    "visitas.citas.read",
    "visitas.citas.write",
    "visitas.citas.checkin",
    "visitas.citas.estado",

    "bitacora.read",
    "bitacora.write",
  ],

  administrador_it: [
    "iam.users.manage",
    "iam.roles.manage",
    "iam.audit.view",

    "system.backups.view",
    "system.backups.manage",
    "system.backups.download",
    "system.backups.schedule",

    "rondasqr.view",
    "rondasqr.export",
    "rondasqr.reports",
    "rondasqr.reports.view",
    "rondasqr.reports.query",
    "rondasqr.reports.export_pdf",
    "rondasqr.reports.map",
    "rondasqr.alerts.read",
    "rondasqr.incidents.read",

    "incidentes.read",
    "incidentes.export",
    "incidentes.reports",

    "accesos.read",
    "accesos.export",

    "visitas.read",
    "visitas.export",
    "visitas.citas.read",

    "bitacora.read",
    "bitacora.write",
    "bitacora.export",

    "reportes.read",
    "reportes.export",
  ],

  visita: [
    "visitas.citas.read",
    "visitas.citas.write",
  ],
};

/* ==================================================
   8) ROLES NORMALIZADOS
   ================================================== */
export const rolesKeysNormalized = {
  administrador: [...ALL_NORMALIZED_PERMISSION_KEYS],
  supervisor: normalizePermissionsList(rolesKeys.supervisor),
  guardia: normalizePermissionsList(rolesKeys.guardia),
  administrador_it: normalizePermissionsList(rolesKeys.administrador_it),
  visita: normalizePermissionsList(rolesKeys.visita),
};

/* ==================================================
   9) HELPERS DE ROLES
   ================================================== */
export function getRolePermissions(roleName, { normalized = false } = {}) {
  const role = String(roleName || "").trim().toLowerCase();
  const source = normalized ? rolesKeysNormalized : rolesKeys;
  return Array.isArray(source[role]) ? [...source[role]] : [];
}

export function getRolePermissionsNormalized(roleName) {
  return getRolePermissions(roleName, { normalized: true });
}

/* ==================================================
   10) AGRUPAR POR MÓDULO
   ================================================== */
export function agruparPorModulo(mapaPermisos = permisosKeys) {
  const grupos = {};
  Object.entries(mapaPermisos).forEach(([key, label]) => {
    const modulo = key.split(".")[0];
    if (!grupos[modulo]) grupos[modulo] = [];
    grupos[modulo].push({ key, label });
  });

  return Object.entries(grupos)
    .map(([module, items]) => ({
      module,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

export function agruparPorModuloNormalized(
  mapaPermisos = permisosKeysNormalized
) {
  return agruparPorModulo(mapaPermisos);
}

/* ==================================================
   11) DEFAULT EXPORT
   ================================================== */
export default {
  permisosKeys,
  permisosKeysNormalized,
  permisosCanonicos,
  LEGACY_PERMISSION_ALIASES,
  rolesKeys,
  rolesKeysNormalized,
  normalizePermissionKey,
  normalizePermissionsList,
  denormalizePermissionKey,
  getPermissionLabel,
  hasPermission,
  getRolePermissions,
  getRolePermissionsNormalized,
  agruparPorModulo,
  agruparPorModuloNormalized,
};