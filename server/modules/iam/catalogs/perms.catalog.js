  // ✅ Catálogo: clave técnica => etiqueta legible (UI)
  // --------------------------------------------------
  // Este archivo queda COMPATIBLE con tu estructura actual,
  // pero añade normalización para evitar conflictos entre:
  // - permisos legacy
  // - permisos canónicos
  // - roles con mezcla de patrones
  //
  // NO rompe:
  // - permisosKeys
  // - rolesKeys
  // - agruparPorModulo
  // - export default
  //
  // AÑADE:
  // - LEGACY_PERMISSION_ALIASES
  // - normalizePermissionKey()
  // - normalizePermissionsList()
  // - rolesKeysNormalized
  // - permisosKeysNormalized
  // --------------------------------------------------

  /* ==================================================
    1) PERMISOS CANÓNICOS (patrón recomendado)
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

    // ======================
    // RONDAS QR
    // ======================
    "rondasqr.assignments.read": "Rondas QR • Asignaciones (ver)",
    "rondasqr.assignments.write": "Rondas QR • Asignaciones (crear/editar/eliminar)",

    "rondasqr.qr.read": "Rondas QR • Repositorio de códigos QR (ver)",
    "rondasqr.qr.generate": "Rondas QR • Generar códigos QR",
    "rondasqr.qr.export": "Rondas QR • Exportar/descargar códigos QR",

    "rondasqr.checkpoints.read": "Rondas QR • Puntos de control (ver)",
    "rondasqr.checkpoints.write": "Rondas QR • Puntos de control (crear/editar/eliminar)",

    "rondasqr.sites.read": "Rondas QR • Sitios (ver)",
    "rondasqr.sites.write": "Rondas QR • Sitios (crear/editar/eliminar)",

    "rondasqr.rounds.read": "Rondas QR • Rondas (ver)",
    "rondasqr.rounds.write": "Rondas QR • Rondas (crear/editar/eliminar)",

    "rondasqr.reports.read": "Rondas QR • Ver informes",
    "rondasqr.reports.query": "Rondas QR • Consultar (filtros)",
    "rondasqr.reports.highlight": "Rondas QR • Destacados (sobresalir)",
    "rondasqr.reports.export": "Rondas QR • Exportar PDF",
    "rondasqr.reports.print": "Rondas QR • Imprimir",
    "rondasqr.reports.map": "Rondas QR • Ver mapa en informes",

    "rondasqr.scan.execute": "Rondas QR • Escanear/registrar punto",
    "rondasqr.scan.manual": "Rondas QR • Registrar punto manual",

    "rondasqr.checks.write": "Rondas QR • Marcar/corregir check",

    "rondasqr.panic.write": "Rondas QR • Enviar alerta de pánico",
    "rondasqr.panic.read": "Rondas QR • Ver alertas de pánico",

    "rondasqr.offline.read": "Rondas QR • Ver/usar modo offline",
    "rondasqr.offline.write": "Rondas QR • Enviar/descargar base offline (dump)",

    // ======================
    // Incidentes
    // ======================
    "incidentes.records.read": "Incidentes • Ver lista/detalle",
    "incidentes.records.write": "Incidentes • Crear/Editar",
    "incidentes.records.delete": "Incidentes • Eliminar",
    "incidentes.records.close": "Incidentes • Cerrar/Aprobar",
    "incidentes.evidences.write": "Incidentes • Adjuntar evidencias",
    "incidentes.reports.read": "Incidentes • Ver reportes",
    "incidentes.reports.export": "Incidentes • Exportar (PDF/Excel/CSV)",

    // ======================
    // Accesos
    // ======================
    "accesos.records.read": "Control de Acceso • Ver",
    "accesos.records.write": "Control de Acceso • Registrar/Editar",
    "accesos.reports.export": "Control de Acceso • Exportar (PDF/Excel/CSV)",

    // ======================
    // Visitas
    // ======================
    "visitas.records.read": "Control de Visitas • Ver",
    "visitas.records.write": "Control de Visitas • Registrar/Editar",
    "visitas.records.close": "Control de Visitas • Aprobar/Cerrar",
    "visitas.reports.export": "Control de Visitas • Exportar (PDF/Excel/CSV)",

    // ======================
    // Bitácora
    // ======================
    "bitacora.records.read": "Bitácora • Ver",
    "bitacora.records.write": "Bitácora • Registrar",
    "bitacora.reports.export": "Bitácora • Exportar (PDF/Excel/CSV)",

    // ======================
    // Reportes generales
    // ======================
    "reportes.dashboard.read": "Reportes • Ver",
    "reportes.exports.export": "Reportes • Exportar (PDF/Excel/CSV)",
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

    // Rondas QR legacy plano
    "rondasqr.view": "rondasqr.rounds.read",
    "rondasqr.create": "rondasqr.assignments.write",
    "rondasqr.edit": "rondasqr.assignments.write",
    "rondasqr.delete": "rondasqr.assignments.write",
    "rondasqr.export": "rondasqr.reports.export",
    "rondasqr.reports": "rondasqr.reports.read",

    // Rondas QR semi-normalizado antiguo
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
    "accesos.export": "accesos.reports.export",

    // Visitas
    "visitas.read": "visitas.records.read",
    "visitas.write": "visitas.records.write",
    "visitas.close": "visitas.records.close",
    "visitas.export": "visitas.reports.export",

    // Bitácora
    "bitacora.read": "bitacora.records.read",
    "bitacora.write": "bitacora.records.write",
    "bitacora.export": "bitacora.reports.export",

    // Reportes generales
    "reportes.read": "reportes.dashboard.read",
    "reportes.export": "reportes.exports.export",
  };

  /* ==================================================
    3) CATÁLOGO LEGACY VISIBLE (COMPAT)
    ================================================== */
  export const permisosKeys = {
    // ======================
    // IAM
    // ======================
    "iam.users.view": "Usuarios y Roles • Ver usuarios",
    "iam.users.manage": "Usuarios y Roles • Gestionar usuarios",
    "iam.roles.manage": "Usuarios y Roles • Gestionar roles",
    "iam.audit.view": "Usuarios y Roles • Ver historial (audit)",

    // ======================
    // RONDAS QR (LEGACY - mantener temporalmente)
    // ======================
    "rondasqr.view": "Rondas QR • Ver lista/detalle",
    "rondasqr.create": "Rondas QR • Crear/Asignar",
    "rondasqr.edit": "Rondas QR • Editar",
    "rondasqr.delete": "Rondas QR • Eliminar",
    "rondasqr.export": "Rondas QR • Exportar (PDF/Excel/CSV)",
    "rondasqr.reports": "Rondas QR • Ver reportes",

    // ======================
    // RONDAS QR (NORMALIZADO - recomendado)
    // ======================
    "rondasqr.assignments.read": "Rondas QR • Asignaciones (ver)",
    "rondasqr.assignments.write": "Rondas QR • Asignaciones (crear/editar/eliminar)",

    "rondasqr.qr.generate": "Rondas QR • Generar códigos QR",
    "rondasqr.qr.repo.read": "Rondas QR • Repositorio de códigos QR (ver)",
    "rondasqr.qr.export": "Rondas QR • Exportar/descargar códigos QR",

    "rondasqr.checkpoints.read": "Rondas QR • Puntos de control (ver)",
    "rondasqr.checkpoints.write": "Rondas QR • Puntos de control (crear/editar/eliminar)",

    "rondasqr.sites.read": "Rondas QR • Sitios (ver)",
    "rondasqr.sites.write": "Rondas QR • Sitios (crear/editar/eliminar)",

    "rondasqr.rounds.read": "Rondas QR • Rondas (ver)",
    "rondasqr.rounds.write": "Rondas QR • Rondas (crear/editar/eliminar)",

    "rondasqr.reports.view": "Rondas QR • Ver informes",
    "rondasqr.reports.query": "Rondas QR • Consultar (filtros)",
    "rondasqr.reports.highlight": "Rondas QR • Destacados (sobresalir)",

    "rondasqr.reports.export_pdf": "Rondas QR • Exportar PDF",
    "rondasqr.reports.print": "Rondas QR • Imprimir",
    "rondasqr.reports.map": "Rondas QR • Ver mapa en informes",

    "rondasqr.scan.qr": "Rondas QR • Escanear QR",
    "rondasqr.scan.manual": "Rondas QR • Registrar punto manual",

    "rondasqr.checks.create": "Rondas QR • Marcar punto (check)",
    "rondasqr.checks.update": "Rondas QR • Corregir/editar check",

    "rondasqr.panic.send": "Rondas QR • Enviar alerta de pánico",
    "rondasqr.panic.read": "Rondas QR • Ver alertas de pánico",

    "rondasqr.offline.use": "Rondas QR • Trabajar sin conexión (cola/outbox)",
    "rondasqr.offline.dump": "Rondas QR • Enviar/descargar base offline (dump)",

    // ======================
    // Incidentes
    // ======================
    "incidentes.read": "Incidentes • Ver lista/detalle",
    "incidentes.create": "Incidentes • Crear",
    "incidentes.edit": "Incidentes • Editar",
    "incidentes.delete": "Incidentes • Eliminar",
    "incidentes.close": "Incidentes • Cerrar/Aprobar",
    "incidentes.export": "Incidentes • Exportar (PDF/Excel/CSV)",
    "incidentes.reports": "Incidentes • Ver reportes",
    "incidentes.attach": "Incidentes • Adjuntar evidencias",

    // ======================
    // Accesos
    // ======================
    "accesos.read": "Control de Acceso • Ver",
    "accesos.write": "Control de Acceso • Registrar/Editar",
    "accesos.export": "Control de Acceso • Exportar (PDF/Excel/CSV)",

    // ======================
    // Visitas
    // ======================
    "visitas.read": "Control de Visitas • Ver",
    "visitas.write": "Control de Visitas • Registrar/Editar",
    "visitas.close": "Control de Visitas • Aprobar/Cerrar",
    "visitas.export": "Control de Visitas • Exportar (PDF/Excel/CSV)",

    // ======================
    // Bitácora
    // ======================
    "bitacora.read": "Bitácora • Ver",
    "bitacora.write": "Bitácora • Registrar",
    "bitacora.export": "Bitácora • Exportar (PDF/Excel/CSV)",

    // ======================
    // Reportes generales
    // ======================
    "reportes.read": "Reportes • Ver",
    "reportes.export": "Reportes • Exportar (PDF/Excel/CSV)",
  };

  /* ==================================================
    4) CATÁLOGO NORMALIZADO EXPUESTO
    ================================================== */
  export const permisosKeysNormalized = { ...permisosCanonicos };

  /* ==================================================
    5) HELPERS DE NORMALIZACIÓN
    ================================================== */
  export function normalizePermissionKey(key) {
    const k = String(key || "").trim();
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
      permisosKeys[raw] ||
      permisosCanonicos[normalizePermissionKey(raw)] ||
      permisosCanonicos[raw] ||
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
    6) HELPER: TODAS LAS KEYS
    ================================================== */
  // Mantiene compat con el comportamiento anterior
  const ALL_PERMISSION_KEYS = Object.keys(permisosKeys);

  // Nuevo total normalizado
  const ALL_NORMALIZED_PERMISSION_KEYS = Object.keys(permisosCanonicos);

  /* ==================================================
    7) ASIGNACIÓN DE PERMISOS POR ROL (LEGACY/COMPAT)
    ================================================== */
  export const rolesKeys = {
    /**
     * ✅ Admin total SIN wildcard (recomendado PROD)
     * Si quieres mantener wildcard, reemplaza por: ["*"]
     */
    administrador: [...ALL_PERMISSION_KEYS],

    supervisor: [
      // IAM (solo vista si quieres que vea usuarios, NO gestione)
      "iam.users.view",
      "iam.audit.view",

      // Legacy rondasqr (temporal)
      "rondasqr.view",
      "rondasqr.create",
      "rondasqr.edit",
      "rondasqr.export",
      "rondasqr.reports",

      // Normalizados rondasqr
      "rondasqr.assignments.read",
      "rondasqr.assignments.write",
      "rondasqr.qr.generate",
      "rondasqr.qr.repo.read",
      "rondasqr.qr.export",
      "rondasqr.checkpoints.read",
      "rondasqr.checkpoints.write",
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
      "rondasqr.offline.use",
      "rondasqr.offline.dump",

      // Incidentes
      "incidentes.read",
      "incidentes.create",
      "incidentes.edit",
      "incidentes.close",
      "incidentes.export",
      "incidentes.reports",
      "incidentes.attach",

      // Accesos
      "accesos.read",
      "accesos.write",
      "accesos.export",

      // Visitas
      "visitas.read",
      "visitas.write",
      "visitas.close",
      "visitas.export",

      // Bitácora
      "bitacora.read",
      "bitacora.write",
      "bitacora.export",

      // Reportes
      "reportes.read",
      "reportes.export",
    ],

    guardia: [
      // IAM (normalmente nada; si quieres que vea su perfil audit, agrega iam.audit.view)
      // Legacy mínimo (temporal)
      "rondasqr.view",
      "rondasqr.create",
      "rondasqr.edit",

      // Operación normalizada
      "rondasqr.scan.qr",
      "rondasqr.scan.manual",
      "rondasqr.checks.create",
      "rondasqr.offline.use",
      "rondasqr.panic.send",
      "rondasqr.panic.read",

      // Incidentes
      "incidentes.read",
      "incidentes.create",
      "incidentes.edit",
      "incidentes.attach",

      // Visitas (si el guardia registra)
      "visitas.write",

      // Bitácora
      "bitacora.read",
      "bitacora.write",
    ],

    /**
     * ✅ Este rol es el que típicamente usas para TI.
     * Si TI debe poder crear usuarios => necesita iam.users.manage
     * Si NO debe poder crear usuarios => deja solo iam.users.view
     */
    administrador_it: [
      // IAM
      "iam.users.manage",
      "iam.roles.manage",
      "iam.audit.view",

      // Rondas: lectura + reportes/export
      "rondasqr.view",
      "rondasqr.export",
      "rondasqr.reports",
      "rondasqr.reports.view",
      "rondasqr.reports.query",
      "rondasqr.reports.export_pdf",
      "rondasqr.reports.map",

      // Incidentes: lectura + export/reportes
      "incidentes.read",
      "incidentes.export",
      "incidentes.reports",

      // Accesos
      "accesos.read",
      "accesos.export",

      // Visitas
      "visitas.read",
      "visitas.export",

      // Bitácora
      "bitacora.read",
      "bitacora.write",
      "bitacora.export",

      // Reportes generales
      "reportes.read",
      "reportes.export",
    ],
  };

  /* ==================================================
    8) ROLES NORMALIZADOS (CANÓNICOS)
    ================================================== */
  export const rolesKeysNormalized = {
    administrador: [...ALL_NORMALIZED_PERMISSION_KEYS],

    supervisor: normalizePermissionsList(rolesKeys.supervisor),

    guardia: normalizePermissionsList(rolesKeys.guardia),

    administrador_it: normalizePermissionsList(rolesKeys.administrador_it),
  };

  /* ==================================================
    9) HELPER DE ROLES
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
  // Agrupar por módulo (prefijo antes del primer ".")
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
    11) DEFAULT EXPORT POR COMPATIBILIDAD
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