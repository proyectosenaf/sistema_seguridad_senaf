// client/src/modules/rondasqr/guard/SidebarGuard.jsx
import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  AlertTriangle,
  QrCode,
  MessageSquare,
  Settings,
  LogOut,
  FileBarChart,
} from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { rondasqrApi } from "../api/rondasqrApi.js";
import { emitLocalPanic } from "../utils/panicBus.js";

/* ==========================
   Helpers roles/perms
========================== */
function toArr(v) {
  return !v ? [] : Array.isArray(v) ? v : [v];
}
function uniqLower(arr) {
  return Array.from(
    new Set(
      toArr(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}
function uniq(arr) {
  return Array.from(new Set(toArr(arr).map((x) => String(x)).filter(Boolean)));
}
function readCsvLS(key) {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(key) || "";
    return raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default function SidebarGuard({
  variant = "desktop",
  collapsed = false,
  onCloseMobile,
  onSendAlert,
  onDumpDb,
  asGlobal = false, // se mantiene por compatibilidad
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout, isAuthenticated } = useAuth0();

  // Claims Auth0
  const ROLES_CLAIM = "https://senaf.local/roles";
  const PERMS_CLAIM = "https://senaf.local/permissions";

  const rolesAuth0 = uniqLower(user?.roles);
  const rolesClaim = uniqLower(user?.[ROLES_CLAIM]);
  const permsClaim = uniq((user?.[PERMS_CLAIM] || []).map((x) => String(x).trim()));

  // DEV override
  const devRoles = import.meta.env.DEV ? uniqLower(readCsvLS("iamDevRoles")) : [];
  const devPerms = import.meta.env.DEV ? uniq(readCsvLS("iamDevPerms")) : [];

  const roles = uniqLower([...rolesAuth0, ...rolesClaim, ...devRoles]);
  const perms = uniq([...permsClaim, ...devPerms]);

  // Reglas de acceso
  const canReports =
    perms.includes("*") ||
    perms.includes("rondasqr.reports") ||
    perms.includes("rondasqr.view") ||
    roles.includes("supervisor") ||
    roles.includes("admin") ||
    roles.includes("rondasqr.admin");

  const canAdmin =
    perms.includes("*") ||
    perms.includes("rondasqr.admin") ||
    roles.includes("admin") ||
    roles.includes("rondasqr.admin");

  const canScan =
    perms.includes("*") ||
    roles.includes("guardia") ||
    perms.includes("rondasqr.view") ||
    perms.includes("rondasqr.reports") ||
    perms.includes("rondasqr.admin") ||
    roles.includes("admin") ||
    roles.includes("rondasqr.admin");

  // UI classes
  const itemBase =
    "group relative block rounded-xl transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  const itemHover = "hover:bg-black/5 dark:hover:bg-white/10";
  const itemActive =
    "bg-black/5 dark:bg-white/15 ring-1 ring-black/10 dark:ring-white/20";

  const navItemsAll = [
    { key: "home", label: "Hogar", icon: Home, to: "/rondasqr/scan", end: true, show: true },
    { key: "scan", label: "Registrador Punto Control", icon: QrCode, to: "/rondasqr/scan/qr", show: canScan },
    { key: "reports", label: "Informes", icon: FileBarChart, to: "/rondasqr/reports", show: canReports },
    { key: "admin", label: "Administración de Rondas", icon: Settings, to: "/rondasqr/admin", show: canAdmin },
  ];

  const navItems = navItemsAll.filter((x) => x.show);

  const actionItems = [
    { key: "alert", label: "Enviar Alerta", icon: AlertTriangle },
    { key: "msg", label: "Mensaje Incidente", icon: MessageSquare },
  ];

  async function handleAction(key) {
    try {
      switch (key) {
        case "alert": {
          if (typeof onSendAlert === "function") {
            await onSendAlert();
            break;
          }

          let gps;
          if (typeof navigator !== "undefined" && "geolocation" in navigator) {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                  resolve();
                },
                () => resolve(),
                { enableHighAccuracy: true, timeout: 5000 }
              );
            });
          }

          await rondasqrApi.panic(gps || null);
          emitLocalPanic({ source: "sidebar", user: user?.email || user?.name || "" });

          window.alert("🚨 Alerta de pánico enviada.");
          navigate("/rondasqr/scan");
          break;
        }

        case "msg":
          navigate("/incidentes/nuevo?from=ronda");
          break;

        case "dumpdb": {
          if (typeof onDumpDb === "function") {
            await onDumpDb();
            break;
          }

          const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
          const payload = {
            at: new Date().toISOString(),
            device: {
              ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
              online: typeof navigator !== "undefined" ? navigator.onLine : false,
            },
          };

          const resp = await fetch(`${apiBase}/api/rondasqr/v1/offline/dump`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          const data = await resp.json().catch(() => null);

          if (resp.ok && data?.ok) {
            window.alert(
              "📤 Base enviada.\n" +
                `marks: ${data.saved?.marks ?? 0}, incidents: ${data.saved?.incidents ?? 0}, device: ${data.saved?.device ?? 0}` +
                (Array.isArray(data.errors) && data.errors.length ? `\ncon errores: ${data.errors.length}` : "")
            );
          } else {
            window.alert(
              "No se pudo enviar la base de datos.\n" +
                `HTTP ${resp.status} ${resp.statusText}\n` +
                (data ? "Respuesta: " + JSON.stringify(data) : "")
            );
          }
          break;
        }

        case "logout": {
          if (isAuthenticated && typeof logout === "function") {
            const returnTo = `${window.location.origin}/login`;
            logout({ logoutParams: { returnTo, federated: true } });
          } else {
            navigate("/login");
          }
          break;
        }

        default:
          break;
      }

      if (variant === "mobile" && onCloseMobile) onCloseMobile();
    } catch (err) {
      console.error("[SidebarGuard] error en acción", err);
      window.alert("Ocurrió un error: " + (err?.message || String(err)));
    }
  }

  const widthClass = variant === "mobile" ? "w-72" : collapsed ? "w-16" : "w-64";

  const containerBase =
    variant === "mobile"
      ? "fixed inset-y-0 left-0 z-50 p-4 border-r overflow-y-auto overscroll-contain md:hidden " +
        "backdrop-blur bg-white/80 dark:bg-black/40 border-black/10 dark:border-white/10 text-slate-900 dark:text-white"
      : "flex p-4 border-r overflow-y-auto overscroll-contain " +
        "backdrop-blur bg-white/60 dark:bg-black/20 border-black/10 dark:border-white/10 text-slate-900 dark:text-white";

  const labelClass = collapsed ? "hidden" : "block";
  const itemPadding = collapsed ? "px-3 py-3" : "px-4 py-3";

  return (
    <aside className={`${containerBase} ${widthClass} flex-col`} aria-label="Navegación del módulo de rondas">
      <div className={`${collapsed ? "text-center" : ""} mb-5`}>
        <div className={`font-extrabold tracking-tight ${collapsed ? "text-base" : "text-2xl"}`}>SENAF</div>
        {!collapsed && <div className="text-xs opacity-70 -mt-1">Rondas de Vigilancia</div>}
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.key}
              to={it.to}
              end={it.end}
              onClick={variant === "mobile" ? onCloseMobile : undefined}
              className={({ isActive }) => [itemBase, isActive ? itemActive : itemHover].join(" ")}
            >
              <div className={`flex items-center gap-3 ${itemPadding}`}>
                <Icon size={18} aria-hidden />
                <span className={`text-[15px] leading-none ${labelClass}`}>{it.label}</span>
              </div>
            </NavLink>
          );
        })}

        {actionItems.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => handleAction(it.key)}
              className={[itemBase, itemHover, "text-left"].join(" ")}
            >
              <div className={`flex items-center gap-3 ${itemPadding}`}>
                <Icon size={18} aria-hidden />
                <span className={`text-[15px] leading-none ${labelClass}`}>{it.label}</span>
              </div>
            </button>
          );
        })}

        <div className="mt-auto pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => handleAction("logout")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                       bg-red-600/10 hover:bg-red-600/20 text-red-400 font-medium
                       transition-colors duration-150"
          >
            <LogOut size={18} aria-hidden />
            <span className={`text-[15px] leading-none ${labelClass}`}>Aplicación Salir</span>
          </button>

          {import.meta.env.DEV && !collapsed && (
            <div className="mt-3 text-[11px] opacity-70 leading-snug">
              <div className="font-semibold">DEV roles/perms</div>
              <div>roles: {roles.join(", ") || "-"}</div>
              <div>perms: {perms.join(", ") || "-"}</div>
              <div>path: {pathname}</div>
              <div>asGlobal: {String(asGlobal)}</div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
