// client/src/config/navConfig.js
import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ShieldCheck,
} from "lucide-react";

/**
 * NAV_SECTIONS (UI)
 * - Solo define navegación visual.
 * - NO define lógica de permisos internos.
 * - El backend decide qué puede ver el usuario mediante me.can
 */
export const NAV_SECTIONS = [
  {
    key: "accesos",
    label: "Control de Acceso",
    path: "/accesos",
    icon: DoorOpen,
    accessKey: "nav.accesos",
  },
  {
    key: "rondas",
    label: "Rondas de Vigilancia",
    path: "/rondasqr",
    icon: Footprints,
    accessKey: "nav.rondas",
  },
  {
    key: "incidentes",
    label: "Gestión de Incidentes",
    path: "/incidentes",
    icon: AlertTriangle,
    accessKey: "nav.incidentes",
  },
  {
    key: "visitas",
    label: "Control de Visitas",
    path: "/visitas",
    icon: Users,
    accessKey: "nav.visitas",
  },
  {
    key: "bitacora",
    label: "Bitácora Digital",
    path: "/bitacora",
    icon: NotebookPen,
    accessKey: "nav.bitacora",
  },
  {
    key: "iam",
    label: "Usuarios y Permisos",
    path: "/iam/admin",
    icon: ShieldCheck,
    accessKey: "nav.iam",
  },
];

/**
 * Extrae objeto de sesión usable
 */
function resolvePrincipal(me) {
  if (!me || typeof me !== "object") return null;

  // si ya viene plano
  if (me.can || me.superadmin === true || me.isSuperAdmin === true) return me;

  // compat si viene anidado
  if (me.user && typeof me.user === "object") {
    return {
      ...me.user,
      can: me.can || me.user.can || null,
      superadmin: me.superadmin === true || me.user.superadmin === true,
      isSuperAdmin: me.isSuperAdmin === true || me.user.isSuperAdmin === true,
    };
  }

  return me;
}

/**
 * getNavSectionsForMe(me)
 * - El frontend solo consume flags calculados por backend.
 * - Si backend no manda me.can, deny-by-default.
 */
export function getNavSectionsForMe(me) {
  const principal = resolvePrincipal(me);
  if (!principal || typeof principal !== "object") return [];

  if (principal.superadmin === true || principal.isSuperAdmin === true) {
    return NAV_SECTIONS;
  }

  const can =
    principal.can && typeof principal.can === "object" ? principal.can : null;

  if (!can) return [];

  return NAV_SECTIONS.filter((item) => can[item.accessKey] === true);
}

export default NAV_SECTIONS;