// client/src/config/navConfig.js
import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ShieldCheck,
  Database, // <-- ESTE ES EL CORRECTO
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
    i18nKey: "nav.accesos",
    path: "/accesos",
    icon: DoorOpen,
    accessKey: "nav.accesos",
  },
  {
    key: "rondas",
    label: "Rondas de Vigilancia",
    i18nKey: "nav.rondas",
    path: "/rondasqr",
    icon: Footprints,
    accessKey: "nav.rondas",
  },
  {
    key: "incidentes",
    label: "Gestión de Incidentes",
    i18nKey: "nav.incidentes",
    path: "/incidentes",
    icon: AlertTriangle,
    accessKey: "nav.incidentes",
  },
  {
    key: "visitas",
    label: "Control de Visitas",
    i18nKey: "nav.visitas",
    path: "/visitas",
    icon: Users,
    accessKey: "nav.visitas",
  },
  {
    key: "bitacora",
    label: "Bitácora Digital",
    i18nKey: "nav.bitacora",
    path: "/bitacora",
    icon: NotebookPen,
    accessKey: "nav.bitacora",
  },
  {
    key: "iam",
    label: "Usuarios y Permisos",
    i18nKey: "nav.iam",
    path: "/iam/admin",
    icon: ShieldCheck,
    accessKey: "nav.iam",
  },
  {
    key: "system",
    label: "Respaldo y Restauración",
    i18nKey: "nav.systemBackups",
    path: "/system/backups",
    icon: Database, // <-- ICONO CORRECTO
    accessKey: "nav.system",
  },
];

function normalizeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function uniqLower(arr) {
  return Array.from(
    new Set(
      normalizeArray(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeCan(v) {
  if (!v) return null;
  if (typeof v === "object" && !Array.isArray(v)) return v;

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Extrae objeto de sesión usable
 */
function resolvePrincipal(me) {
  if (!me || typeof me !== "object") return null;

  const nestedUser =
    me.user && typeof me.user === "object" ? me.user : null;

  const source = nestedUser
    ? { ...nestedUser, ...me }
    : { ...me };

  const roles = uniqLower(source.roles);
  const permissions = uniqLower(source.permissions || source.perms);
  const can = normalizeCan(source.can);

  return {
    ...source,
    roles,
    permissions,
    perms: permissions,
    can,
    superadmin:
      source.superadmin === true || source.isSuperAdmin === true,
    isSuperAdmin:
      source.isSuperAdmin === true || source.superadmin === true,
  };
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