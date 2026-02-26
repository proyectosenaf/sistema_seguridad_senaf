// client/src/config/navConfig.js
import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";

/**
 * Secciones visibles en Home/Sidebar y menú rápido del Topbar.
 * Importante:
 * - key debe ser estable porque a menudo se usa para mapear badges/contadores.
 * - path debe ser canónico (evitar aliases legacy).
 */
export const NAV_SECTIONS = [
  { key: "accesos", label: "Control de Acceso", path: "/accesos", icon: DoorOpen },

  // ✅ usar path canónico de rondas
  { key: "rondas", label: "Rondas de Vigilancia", path: "/rondasqr/admin", icon: Footprints },

  { key: "incidentes", label: "Gestión de Incidentes", path: "/incidentes", icon: AlertTriangle },
  { key: "visitas", label: "Control de Visitas", path: "/visitas", icon: Users },
  { key: "bitacora", label: "Bitácora Digital", path: "/bitacora", icon: NotebookPen },

  { key: "supervision", label: "Supervisión", path: "/supervision", icon: ClipboardList },

  // ✅ IAM visible en todos los menús
  { key: "iam", label: "Usuarios y Permisos", path: "/iam/admin", icon: ShieldCheck },
];
