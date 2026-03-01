// client/src/config/navConfig.js
import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

export const NAV_SECTIONS = [
  { key: "accesos", label: "Control de Acceso", path: "/accesos", icon: DoorOpen },
  { key: "rondas", label: "Rondas de Vigilancia", path: "/rondasqr/admin", icon: Footprints },
  { key: "incidentes", label: "Gestión de Incidentes", path: "/incidentes", icon: AlertTriangle },
  { key: "visitas", label: "Control de Visitas", path: "/visitas", icon: Users },
  { key: "bitacora", label: "Bitácora Digital", path: "/bitacora", icon: NotebookPen },
  { key: "supervision", label: "Supervisión", path: "/supervision", icon: ClipboardList },
  { key: "iam", label: "Usuarios y Permisos", path: "/iam/admin", icon: ShieldCheck },
];

/**
 * Filtra secciones según sesión (sin hardcode de permisos, usa routeRules/can del backend)
 */
export function getNavSectionsForMe(me) {
  const isVisitor = !!me?.visitor || !!me?.isVisitor;

  // visitante: solo visitas (y si quieres, agenda)
  if (isVisitor) {
    return NAV_SECTIONS.filter((s) => s.key === "visitas");
  }

  // si backend manda "can", filtra por eso (parametrizado por routeKey)
  const can = me?.can || null;
  if (can && typeof can === "object") {
    // mapa simple key -> routeKey (si quieres, muévelo a APP_CONFIG también)
    const map = {
      accesos: "accesos",
      rondas: "rondasqr.admin",
      incidentes: "incidentes",
      visitas: "visitas.control",
      bitacora: "bitacora",
      supervision: "supervision",
      iam: "iam.admin",
    };

    return NAV_SECTIONS.filter((s) => {
      const rk = map[s.key];
      if (!rk) return true;
      return can[rk] !== false; // si no existe, no lo mates
    });
  }

  return NAV_SECTIONS;
}