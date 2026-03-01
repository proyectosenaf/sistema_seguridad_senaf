// client/src/modules/rondasqr/guard/SidebarGuard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MessageSquare, LogOut } from "lucide-react";

import { rondasqrApi } from "../api/rondasqrApi.js";
import { emitLocalPanic } from "../utils/panicBus.js";
import iamApi from "../../../iam/api/iamApi.js";
import { clearToken } from "../../../lib/api.js";

const ROUTE_LOGIN = String(import.meta.env.VITE_ROUTE_LOGIN || "/login").trim() || "/login";

/**
 * SidebarGuard (refactor):
 * - Ya NO compite con el Sidebar global.
 * - Es un "Action Panel" del módulo de rondas.
 *
 * Reglas:
 * - Si asGlobal=true => no renderiza (porque ya existe Layout+Sidebar global)
 * - Si asGlobal=false => muestra acciones del módulo
 */
export default function SidebarGuard({
  variant = "desktop", // "desktop" | "mobile"
  onCloseMobile,
  onSendAlert,
  asGlobal = false,
}) {
  const navigate = useNavigate();

  // ✅ Si el módulo está dentro del Layout global, NO mostrar este panel
  if (asGlobal) return null;

  async function doLogout() {
    // 1) backend logout (si existe)
    try {
      await iamApi.logout();
    } catch {
      // no bloquea
    }

    // 2) limpia token canónico + legacy + dev flags si existen
    try {
      clearToken();
      localStorage.removeItem("token");
      localStorage.removeItem("iamDevEmail");
      localStorage.removeItem("iamDevRoles");
      localStorage.removeItem("iamDevPerms");
    } catch {}

    navigate(ROUTE_LOGIN, { replace: true });
  }

  async function handleAlert() {
    // Si te pasan handler externo, úsalo
    if (typeof onSendAlert === "function") {
      await onSendAlert();
      if (variant === "mobile" && onCloseMobile) onCloseMobile();
      return;
    }

    // fallback: toma gps si se puede y manda panic
    let gps = null;
    try {
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
    } catch {
      // ignore
    }

    await rondasqrApi.panic(gps);

    emitLocalPanic({
      source: "rondas_action_panel",
      user: "",
    });

    window.alert("🚨 Alerta de pánico enviada.");
    navigate("/rondasqr/scan");

    if (variant === "mobile" && onCloseMobile) onCloseMobile();
  }

  function handleMsg() {
    navigate("/incidentes/nuevo?from=ronda");
    if (variant === "mobile" && onCloseMobile) onCloseMobile();
  }

  const containerBase =
    variant === "mobile"
      ? "fixed inset-y-0 left-0 z-50 p-4 border-r overflow-y-auto overscroll-contain md:hidden " +
        "backdrop-blur bg-white/80 dark:bg-black/40 border-black/10 dark:border-white/10 text-slate-900 dark:text-white w-72"
      : "flex flex-col p-4 border-r overflow-y-auto overscroll-contain " +
        "backdrop-blur bg-white/60 dark:bg-black/20 border-black/10 dark:border-white/10 text-slate-900 dark:text-white w-64";

  const itemBase =
    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition " +
    "border border-neutral-200/60 dark:border-white/10 " +
    "bg-white/55 dark:bg-neutral-950/35 backdrop-blur-xl shadow-sm " +
    "hover:bg-white/70 dark:hover:bg-neutral-900/45";

  return (
    <aside className={containerBase} aria-label="Acciones del módulo de rondas">
      <div className="mb-5">
        <div className="font-extrabold tracking-tight text-2xl">SENAF</div>
        <div className="text-xs opacity-70 -mt-1">Rondas de Vigilancia</div>
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={handleAlert} className={itemBase}>
          <AlertTriangle size={18} aria-hidden />
          <span className="text-[15px] leading-none">Enviar Alerta</span>
        </button>

        <button type="button" onClick={handleMsg} className={itemBase}>
          <MessageSquare size={18} aria-hidden />
          <span className="text-[15px] leading-none">Mensaje Incidente</span>
        </button>
      </div>

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={doLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                     bg-red-600/10 hover:bg-red-600/20 text-red-400 font-medium
                     transition-colors duration-150"
        >
          <LogOut size={18} aria-hidden />
          <span className="text-[15px] leading-none">Salir</span>
        </button>
      </div>
    </aside>
  );
}