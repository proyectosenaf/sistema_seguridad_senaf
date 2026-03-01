// client/src/components/Sidebar.jsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LogOut } from "lucide-react";

// ✅ Auth local (RUTA REAL)
import { useAuth } from "../pages/auth/AuthProvider.jsx";

// ✅ Token canónico (centralizado)
import { clearToken } from "../lib/api.js";

// ✅ Config central de navegación
import { NAV_SECTIONS } from "../config/navConfig.js";

const ROUTE_LOGIN = String(import.meta.env.VITE_ROUTE_LOGIN || "/login").trim() || "/login";

// Opcional: limitar qué secciones se muestran sin hardcode
// Ej: VITE_NAV_KEYS_ALLOWLIST="accesos,rondas,visitas"
const NAV_KEYS_ALLOWLIST = String(import.meta.env.VITE_NAV_KEYS_ALLOWLIST || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
        {Icon ? (
          <Icon className="w-6 h-6 shrink-0 text-neutral-800 dark:text-white" strokeWidth={2} />
        ) : (
          <span className="w-6 h-6 shrink-0" />
        )}
        <span className="text-[16px] leading-none text-neutral-900 dark:text-white">{label}</span>
      </div>
    </NavLink>
  );
}

export default function Sidebar({ onNavigate, variant }) {
  const nav = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleLogoutClick = async () => {
    onNavigate?.();

    // 1) logout del provider (tu AuthProvider lo soporta)
    try {
      await logout?.();
    } catch {
      // no bloquea
    }

    // 2) limpia token canónico + legacy
    try {
      clearToken(); // senaf_token (canónico)
      localStorage.removeItem("token"); // legacy por compat
      localStorage.removeItem("access_token"); // por si quedó algo viejo
    } catch {
      // ignore
    }

    // 3) manda a login (parametrizado)
    nav(ROUTE_LOGIN, { replace: true });
  };

  // Home + secciones centralizadas
  const homeItem = {
    key: "home",
    label: "Director del panel",
    path: "/",
    icon: Home,
    emphasizeDark: true,
  };

  const sections = Array.isArray(NAV_SECTIONS) ? NAV_SECTIONS : [];
  const filteredSections =
    NAV_KEYS_ALLOWLIST.length > 0
      ? sections.filter((x) => NAV_KEYS_ALLOWLIST.includes(String(x.key || "").trim()))
      : sections;

  const items = [
    homeItem,
    ...filteredSections.map((s) => ({
      key: s.key,
      label: s.label,
      path: s.path,
      icon: s.icon, // debe ser componente (ej: DoorOpen), no string
      emphasizeDark: false,
    })),
  ];

  return (
    <div
      className={[
        "w-full h-full flex flex-col overflow-y-auto overscroll-contain p-4",
        "bg-white/55 dark:bg-neutral-950/45 backdrop-blur-2xl",
        "border-r border-neutral-200/60 dark:border-white/10",
      ].join(" ")}
      aria-label={variant === "mobile" ? "Barra lateral (móvil)" : "Barra lateral"}
    >
      <div className="text-2xl font-extrabold mb-6 tracking-tight">SENAF</div>

      <nav className="flex flex-col gap-1 text-[15px]">
        {items.map(({ key, path, label, icon: Icon, emphasizeDark }) => (
          <NavItem
            key={key || path}
            to={path}
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