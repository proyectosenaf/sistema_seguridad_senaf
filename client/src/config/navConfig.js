// Orden ÚNICO para toda la app (sidebar y panel principal)
export const NAV_ORDER = [
  { key: "home",       label: "Panel principal",       path: "/" },
  { key: "accesos",    label: "Control de Acceso",     path: "/accesos" },
  { key: "rondas",     label: "Rondas de Vigilancia",  path: "/rondas" },
  { key: "incidentes", label: "Gestión de Incidentes", path: "/incidentes" },
  { key: "visitas",    label: "Control de Visitas",    path: "/visitas" },
  { key: "bitacora",   label: "Bitácora Digital",      path: "/bitacora" },
  { key: 'supervision', label: 'Supervisión',          path: '/supervision' },
  { key: "evaluacion", label: "Evaluación",            path: "/evaluacion" },
  
];

// Secciones que deben aparecer en el Panel principal (omitimos "home")
export const NAV_SECTIONS = NAV_ORDER.filter(i => i.key !== "home");
