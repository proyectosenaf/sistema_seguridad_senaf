// client/src/iam/catalog/perms.js

// 1) Catálogo: clave técnica => etiqueta legible (para UI)
export const permisosKeys = {
  // IAM
  "iam.users.manage": "Usuarios y Roles • Gestionar usuarios",
  "iam.roles.manage": "Usuarios y Roles • Gestionar roles",

  // Rondas
  "rondas.read":   "Rondas • Ver lista/detalle",
  "rondas.create": "Rondas • Crear/Asignar",
  "rondas.edit":   "Rondas • Editar",
  "rondas.delete": "Rondas • Eliminar",
  "rondas.export": "Rondas • Exportar (PDF/Excel/CSV)",
  "rondas.reports":"Rondas • Ver reportes",

  // Incidentes
  "incidentes.read":   "Incidentes • Ver lista/detalle",
  "incidentes.create": "Incidentes • Crear",
  "incidentes.edit":   "Incidentes • Editar",
  "incidentes.delete": "Incidentes • Eliminar",
  "incidentes.close":  "Incidentes • Cerrar/Aprobar",
  "incidentes.export": "Incidentes • Exportar (PDF/Excel/CSV)",
  "incidentes.reports":"Incidentes • Ver reportes",
  "incidentes.attach": "Incidentes • Adjuntar evidencias",

  // Control de Acceso
  "accesos.read":   "Control de Acceso • Ver",
  "accesos.write":  "Control de Acceso • Registrar/Editar",
  "accesos.export": "Control de Acceso • Exportar",

  // Control de Visitas
  "visitas.read":   "Control de Visitas • Ver",
  "visitas.write":  "Control de Visitas • Registrar/Editar",
  "visitas.close":  "Control de Visitas • Aprobar/Cerrar",
  "visitas.export": "Control de Visitas • Exportar",

  // Bitácora
  "bitacora.read":   "Bitácora • Ver",
  "bitacora.write":  "Bitácora • Registrar",
  "bitacora.export": "Bitácora • Exportar",

  // Supervisión
  "supervision.read":    "Supervisión • Ver lista/detalle",
  "supervision.create":  "Supervisión • Crear",
  "supervision.edit":    "Supervisión • Editar",
  "supervision.close":   "Supervisión • Cerrar/Aprobar",
  "supervision.reports": "Supervisión • Ver reportes",

  // Evaluación
  "evaluacion.list":   "Evaluación • Ver lista/detalle",
  "evaluacion.create": "Evaluación • Crear / Asignar",
  "evaluacion.edit":   "Evaluación • Editar",
  "evaluacion.delete": "Evaluación • Eliminar",
  "evaluacion.close":  "Evaluación • Aprobar / Cerrar",
  "evaluacion.export": "Evaluación • Exportar (PDF/Excel/CSV)",
  "evaluacion.reports":"Evaluación • Ver reportes",
  "evaluacion.kpi":    "Evaluación • Ver análisis / KPI",
  "evaluacion.alerts": "Evaluación • Gestionar alertas",
  "evaluacion.attach": "Evaluación • Adjuntar evidencias",

  // Reportes generales
  "reportes.read": "Reportes • Ver",
};

// 2) Asignación de permisos por rol (solo KEYS)
export const rolesKeys = {
  admin: [
    "*", // acceso total (opcional; tu BE puede respetarlo)
    "iam.users.manage",
    "iam.roles.manage",
  ],

  supervisor: [
    "rondas.read","rondas.create","rondas.edit","rondas.export","rondas.reports",
    "incidentes.read","incidentes.create","incidentes.edit","incidentes.close","incidentes.export","incidentes.reports","incidentes.attach",
    "accesos.read","accesos.write","accesos.export",
    "visitas.read","visitas.write","visitas.close","visitas.export",
    "bitacora.read","bitacora.write","bitacora.export",
    "supervision.read","supervision.create","supervision.edit","supervision.close","supervision.reports",
    "evaluacion.list","evaluacion.create","evaluacion.edit","evaluacion.close","evaluacion.export","evaluacion.reports","evaluacion.kpi","evaluacion.alerts","evaluacion.attach",
    "reportes.read",
  ],

  guardia: [
    // “solo propios” se maneja en backend por ownership del registro
    "rondas.read","rondas.create","rondas.edit",
    "incidentes.read","incidentes.create","incidentes.edit","incidentes.attach",
    "visitas.write",
    "bitacora.read","bitacora.write",
    "evaluacion.list","evaluacion.edit","evaluacion.attach",
  ],

  admin_it: [
    "iam.roles.manage",
    "rondas.read","rondas.export","rondas.reports",
    "incidentes.read","incidentes.export","incidentes.reports",
    "accesos.read","accesos.export",
    "visitas.read","visitas.export",
    "bitacora.read","bitacora.write","bitacora.export",
    "supervision.read","supervision.reports",
    "evaluacion.list","evaluacion.create","evaluacion.edit","evaluacion.delete","evaluacion.export","evaluacion.reports","evaluacion.kpi","evaluacion.alerts","evaluacion.attach",
    "reportes.read",
  ],

  visita_externa: [
    "visitas.read",
  ],
};

// 3) Utilidad: agrupar por módulo (prefijo antes del primer ".")
export function groupByModule(keysMap = permisosKeys) {
  const groups = {};
  Object.entries(keysMap).forEach(([key, label]) => {
    const group = key.split(".")[0]; // ej: "rondas"
    if (!groups[group]) groups[group] = [];
    groups[group].push({ key, label });
  });
  // ordena por label dentro de cada grupo y por nombre de grupo
  return Object.entries(groups)
    .map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}
