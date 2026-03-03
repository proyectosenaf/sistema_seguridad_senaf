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

function hasRole(me, role) {
  const roles = Array.isArray(me?.roles) ? me.roles : Array.isArray(me?.user?.roles) ? me.user.roles : [];
  const r = String(role || "").toLowerCase();
  return roles.some((x) => String(x || "").toLowerCase() === r);
}

/**
 * getNavSectionsForMe(me)
 *
 * ✅ Objetivo:
 * - me null => DENY BY DEFAULT ([])
 * - Visitor => SOLO "visitas"
 * - superadmin => TODO
 * - Si hay "can" (ACL del backend) => filtra por can (solo true)
 * - Si no hay "can" => todo (solo para NO visitantes)
 */
export function getNavSectionsForMe(me) {
  // ✅ deny-by-default: si todavía no hay /me, NO muestres menú completo
  if (!me || typeof me !== "object") return [];

  // ✅ superadmin explícito (si backend lo manda)
  if (me?.superadmin === true) return NAV_SECTIONS;

  // Detecta visitante por flags o por rol
  const isVisitor =
    !!me?.visitor ||
    !!me?.isVisitor ||
    hasRole(me, "visita") ||
    hasRole(me, "visitor");

  if (isVisitor) {
    return NAV_SECTIONS.filter((s) => s.key === "visitas");
  }

  // si backend manda "can", filtra por eso
  const can = me?.can || null;
  if (can && typeof can === "object") {
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
      if (!rk) return false; // deny-by-default si no está mapeado
      return can[rk] === true; // ✅ solo true habilita
    });
  }

  // si no hay can => usuario interno (no visitante) => todo
  return NAV_SECTIONS;
}