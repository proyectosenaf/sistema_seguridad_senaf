// client/src/iam/catalog/perms.js

// ✅ Catálogo: clave técnica => etiqueta legible (UI)
export const permisosKeys = {
  // ======================
  // IAM
  // ======================
  "iam.users.view": "Usuarios y Roles • Ver usuarios",
  "iam.users.manage": "Usuarios y Roles • Gestionar usuarios",
  "iam.roles.manage": "Usuarios y Roles • Gestionar roles",

  // (opcional pero recomendado si tienes AuditPage)
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
  // Visitas (si NO lo usas, puedes eliminar este bloque + permisos en roles)
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
  // Supervisión
  // ======================
  "supervision.read": "Supervisión • Ver lista/detalle",
  "supervision.create": "Supervisión • Crear",
  "supervision.edit": "Supervisión • Editar",
  "supervision.close": "Supervisión • Cerrar/Aprobar",
  "supervision.reports": "Supervisión • Ver reportes",
  "supervision.export": "Supervisión • Exportar (PDF/Excel/CSV)",

  // ======================
  // Reportes generales
  // ======================
  "reportes.read": "Reportes • Ver",
  "reportes.export": "Reportes • Exportar (PDF/Excel/CSV)",
};

/**
 * Helper: todas las keys (para rol admin sin wildcard)
 */
const ALL_PERMISSION_KEYS = Object.keys(permisosKeys);

/**
 * ✅ Asignación de permisos por rol (keys)
 * Nota: si eliminas Visitas, también elimina sus keys aquí.
 */
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

    // Supervisión
    "supervision.read",
    "supervision.create",
    "supervision.edit",
    "supervision.close",
    "supervision.reports",
    "supervision.export",

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

    // Supervisión
    "supervision.read",
    "supervision.reports",
    "supervision.export",

    // Reportes generales
    "reportes.read",
    "reportes.export",
  ],
};

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

// ✅ default export por compatibilidad
export default { permisosKeys, rolesKeys, agruparPorModulo }; 