import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home, AlertTriangle, QrCode, MessageSquare, Camera, Send, Database,
  Settings, LogOut, BookOpen, Info, Languages, FileBarChart
} from "lucide-react";
import { rondasqrApi } from "../api/rondasqrApi.js";

export default function SidebarGuard({
  variant = "desktop",   // "desktop" | "mobile"
  collapsed = false,     // sólo aplica a desktop (md+)
  onCloseMobile,
}) {
  const itemBase =
    "group relative block rounded-xl transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-indigo-400 dark:focus-visible:ring-cyan-400";
  const itemHover  = "hover:bg-slate-900/5 dark:hover:bg-white/10";
  const itemActive = "bg-slate-900/10 dark:bg-white/15 ring-1 ring-slate-900/10 dark:ring-white/20";

  const navItems = [
    { key: "home",    label: "Hogar",                     icon: Home,         to: "/rondasqr/scan", end: true },
    { key: "scan",    label: "Registrador Punto Control", icon: QrCode,       to: "/rondasqr/scan/qr" },
    { key: "reports", label: "Informes",                  icon: FileBarChart, to: "/rondasqr/reports" },
    { key: "admin",   label: "Administración de Rondas",  icon: Settings,     to: "/rondasqr/admin" },
  ];

  const actionItems = [
    { key: "alert",   label: "Enviar Alerta",        icon: AlertTriangle },
    { key: "msg",     label: "Mensaje Incidente",    icon: MessageSquare },
    { key: "photo",   label: "Enviar foto",          icon: Camera },
    { key: "tx",      label: "Transmitir Rondas",    icon: Send },
    { key: "dumpdb",  label: "Enviar base de datos", icon: Database },
    { key: "manuals", label: "Manuales",             icon: BookOpen },
    { key: "about",   label: "Acerca",               icon: Info },
    { key: "lang",    label: "Idioma",               icon: Languages },
    { key: "logout",  label: "Aplicación Salir",     icon: LogOut },
  ];

  async function handleAction(key) {
    try {
      switch (key) {
        case "alert": {
          let gps;
          if ("geolocation" in navigator) {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => { gps = { lat: pos.coords.latitude, lon: pos.coords.longitude }; resolve(); },
                () => resolve(),
                { enableHighAccuracy: true, timeout: 5000 }
              );
            });
          }
          await rondasqrApi.panic(gps);
          window.alert("🚨 Alerta de pánico enviada.");
          break;
        }
        case "msg":     window.location.assign("/incidentes/nuevo"); break;
        case "photo":   window.alert("📷 Enviar foto: pendiente."); break;
        case "tx":      window.alert("⬆️ Transmitir Rondas: pendiente."); break;
        case "dumpdb":  window.alert("💾 Enviar base de datos: pendiente."); break;
        case "manuals": window.open("https://example.com/manual.pdf","_blank","noopener,noreferrer"); break;
        case "about":   window.alert("ℹ️ SENAF · Módulo Rondas QR"); break;
        case "lang":    window.alert("🌐 Cambio de idioma: pendiente."); break;
        case "logout":  window.location.assign("/login"); break;
        default: break;
      }
      if (variant === "mobile" && onCloseMobile) onCloseMobile();
    } catch (err) {
      console.error("[SidebarGuard]", err);
      window.alert("Ocurrió un error ejecutando la acción.");
    }
  }

  const widthClass =
    variant === "mobile" ? "w-72" : collapsed ? "w-16" : "w-64";

  // Fondo sólido en claro + gradiente en oscuro
  const containerBase =
    variant === "mobile"
      ? "fixed inset-y-0 left-0 z-50 p-4 border-r overflow-y-auto overscroll-contain " +
        "bg-slate-50 border-slate-200 text-slate-800 backdrop-blur md:hidden " +
        "dark:bg-gradient-to-b dark:from-[#2a0f3a]/90 dark:via-[#1b0e2b]/90 dark:to-[#062a22]/90 " +
        "dark:border-white/10 dark:text-white"
      : "hidden md:flex p-4 border-r overflow-y-auto overscroll-contain " +
        "bg-slate-50/80 border-slate-200 text-slate-800 backdrop-blur " +
        "dark:bg-transparent dark:border-white/10 dark:text-white";

  const labelClass  = collapsed ? "hidden" : "block";
  const itemPadding = collapsed ? "px-3 py-3" : "px-4 py-3";

  return (
    <aside
      className={`${containerBase} ${widthClass} flex-col`}
      aria-label="Navegación del módulo de rondas"
    >
      {/* Encabezado */}
      <div className={`${collapsed ? "text-center" : ""} mb-5`}>
        <div className={`font-extrabold tracking-tight ${collapsed ? "text-base" : "text-2xl"} text-slate-900 dark:text-white`}>
          SENAF
        </div>
        {!collapsed && (
          <div className="text-xs text-slate-500 dark:text-white/80 -mt-1">
            Rondas de Vigilancia
          </div>
        )}
      </div>

      {/* Navegación */}
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
      </nav>
    </aside>
  );
}
