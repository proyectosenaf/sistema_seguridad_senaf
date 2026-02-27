// client/src/components/Sidebar.jsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  DoorOpen,
  Footprints,
  AlertTriangle,
  UsersRound,
  NotebookPen,
  ClipboardList,
  ShieldCheck,
  LogOut,
} from "lucide-react";

// ✅ IMPORTA useAuth (esto faltaba y causaba 500)


const NAV_ITEMS = [
  { to: "/", label: "Panel principal", Icon: Home, emphasizeDark: true },

  { to: "/accesos", label: "Control de Acceso", Icon: DoorOpen },
  { to: "/rondasqr/scan", label: "Rondas de Vigilancia", Icon: Footprints },
  { to: "/incidentes", label: "Gestión de Incidentes", Icon: AlertTriangle },
  { to: "/visitas", label: "Control de Visitas", Icon: UsersRound },
  { to: "/bitacora", label: "Bitácora Digital", Icon: NotebookPen },
  { to: "/supervision", label: "Supervisión", Icon: ClipboardList },
  { to: "/iam/admin", label: "Usuarios y Permisos", Icon: ShieldCheck },
];

function isPathActive(currentPath, to) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(to + "/");
}

function NavItem({ to, label, Icon, onClick, emphasizeDark = false }) {
  const { pathname } = useLocation();
  const active = isPathActive(pathname, to);

  const base =
    "group relative block rounded-2xl transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]";

  const inactive = "hover:bg-white/40 dark:hover:bg-white/10";
  const activeCls =
    "bg-white/55 dark:bg-white/12 ring-1 ring-neutral-200/70 dark:ring-white/10";

  const emphasizeCls = emphasizeDark ? "dark:bg-white/10 dark:ring-white/12" : "";

  return (
    <NavLink
      to={to}
      onClick={(e) => onClick?.(e)}
      className={[base, active ? activeCls : inactive, emphasizeCls].filter(Boolean).join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className="w-6 h-6 shrink-0 text-neutral-800 dark:text-white" strokeWidth={2} />
        <span className="text-[16px] leading-none text-neutral-900 dark:text-white">{label}</span>
      </div>
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const nav = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleLogoutClick = () => {
    onNavigate?.();
    try {
      logout?.();
    } finally {
      // limpia también token si tu app lo usa
      try {
        localStorage.removeItem("senaf_token");
      } catch {}
      nav("/login", { replace: true });
    }
  };

  return (
    <div
      className={[
        "w-full h-full flex flex-col overflow-y-auto overscroll-contain p-4",
        "bg-white/55 dark:bg-neutral-950/45 backdrop-blur-2xl",
        "border-r border-neutral-200/60 dark:border-white/10",
      ].join(" ")}
      aria-label="Barra lateral"
    >
      <div className="text-2xl font-extrabold mb-6 tracking-tight">SENAF</div>

      <nav className="flex flex-col gap-1 text-[15px]">
        {NAV_ITEMS.map(({ to, label, Icon, emphasizeDark }) => (
          <NavItem
            key={to}
            to={to}
            label={label}
            Icon={Icon}
            onClick={onNavigate}
            emphasizeDark={emphasizeDark}
          />
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div className="border-t border-white/10 mb-3" />

        {isAuthenticated && (
          <button
            type="button"
            onClick={handleLogoutClick}
            title="Cerrar sesión"
            className={[
              "group w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition",
              "border border-neutral-200/60 dark:border-white/10",
              "bg-white/55 dark:bg-neutral-950/35 backdrop-blur-xl shadow-sm",
              "hover:bg-white/70 dark:hover:bg-neutral-900/45",
            ].join(" ")}
          >
            <LogOut className="w-5 h-5 text-neutral-900 dark:text-white" strokeWidth={2.5} />
            <span className="font-medium">Salir</span>
          </button>
        )}
      </div>
    </div>
  );
}