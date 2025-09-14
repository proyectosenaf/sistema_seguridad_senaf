import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home, DoorOpen, KeyRound, Footprints, Route,
  AlertTriangle, UsersRound, Users, NotebookPen,
  ClipboardList, ClipboardCheck, Award, BarChart3, LogIn
} from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";

/* Íconos alineados con “Secciones” (+ fallbacks) */
const IconDoor       = DoorOpen || KeyRound;
const IconFootprints = Footprints || Route;
const IconVisitors   = UsersRound || Users;
const IconEval       = ClipboardCheck || Award;

const NAV_ITEMS = [
  { to: "/",            label: "Panel principal",        Icon: Home, emphasizeDark: true },
  { to: "/accesos",     label: "Control de Acceso",      Icon: IconDoor },
  { to: "/rondas",      label: "Rondas de Vigilancia",   Icon: IconFootprints },
  { to: "/incidentes",  label: "Gestión de Incidentes",  Icon: AlertTriangle },
  { to: "/visitas",     label: "Control de Visitas",     Icon: IconVisitors },
  { to: "/bitacora",    label: "Bitácora Digital",       Icon: NotebookPen },
  { to: "/supervision", label: "Supervisión",            Icon: ClipboardList },
  { to: "/evaluacion",  label: "Evaluación",             Icon: IconEval },
  { to: "/reportes",    label: "Reportes",               Icon: BarChart3 },
];

function NavItem({ to, label, Icon, onClick, emphasizeDark = false }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "group relative block rounded-xl transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]",
          !isActive
            ? "hover:bg-white/60 hover:ring-1 hover:ring-neutral-400/40"
            : "bg-white/70 ring-1 ring-neutral-300/70",
          "dark:hover:bg-white/10",
          emphasizeDark && "dark:bg-white/10 dark:ring-1 dark:ring-white/15",
          isActive && "dark:bg-white/14 dark:ring-white/20",
        ].join(" ")
      }
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className="w-6 h-6 shrink-0 text-neutral-800 dark:text-white" strokeWidth={2} />
        <span className="text-[17px] leading-none text-neutral-900 dark:text-white">
          {label}
        </span>
      </div>
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { loginWithRedirect } = useAuth0();

  async function handleLoginClick() {
    onNavigate?.();
    await loginWithRedirect({
      authorizationParams: {
        redirect_uri: window.location.origin,
        prompt: "login",
        screen_hint: "login",
      },
    });
  }

  return (
    <div
      className={[
        // ⬇️ Contenedor del sidebar: ocupa todo el alto disponible del aside fijo
        "w-full h-full flex flex-col overflow-y-auto overscroll-contain",
        "border-r border-white/10 p-4 sidebar-aurora",
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

      {/* Login al fondo, con buen contraste en claro y en oscuro */}
      <div className="mt-auto pt-6">
        <div className="border-t border-white/10 mb-3" />
        <button
          type="button"
          onClick={handleLoginClick}
          title="Ir a Login"
          className={[
            "group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left",
            "bg-white/70 border border-neutral-300/70 text-neutral-900 hover:bg-white/80 hover:ring-1 hover:ring-neutral-400/40",
            "dark:bg-white/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10",
          ].join(" ")}
        >
          <LogIn className="w-5 h-5 text-neutral-900 dark:text-white" strokeWidth={2.5} />
          <span className="font-medium">Login</span>
        </button>
      </div>
    </div>
  );
}
