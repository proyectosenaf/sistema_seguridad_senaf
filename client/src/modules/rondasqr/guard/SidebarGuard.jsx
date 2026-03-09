// client/src/modules/rondasqr/guard/SidebarGuard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MessageSquare, LogOut } from "lucide-react";

import { rondasqrApi } from "../api/rondasqrApi.js";
import { emitLocalPanic } from "../utils/panicBus.js";
import iamApi from "../../../iam/api/iamApi.js";
import { clearToken } from "../../../lib/api.js";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

const ROUTE_LOGIN =
  String(import.meta.env.VITE_ROUTE_LOGIN || "/login").trim() || "/login";

const ROUTE_RONDAS_SCAN = "/rondasqr/scan";
const ROUTE_INCIDENTE_NUEVO = "/incidentes/nuevo?from=ronda";

// Consistencia de keys
const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";
const VISITOR_HINT_KEY = "senaf_is_visitor";

export default function SidebarGuard({
  variant = "desktop", // "desktop" | "mobile"
  onCloseMobile,
  onSendAlert,
  asGlobal = false,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth(); // ✅ logout central

  if (asGlobal) return null;

  async function doLogout() {
    // 1️⃣ Logout del backend IAM
    try {
      await iamApi.logout?.();
    } catch {}

    // 2️⃣ Logout central del AuthProvider
    try {
      await logout?.();
    } catch {}

    // 3️⃣ Limpieza completa del cliente
    try {
      clearToken(); // senaf_token

      localStorage.removeItem("token");
      localStorage.removeItem("access_token");

      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(VISITOR_HINT_KEY);

      sessionStorage.removeItem(RETURN_TO_KEY);

      // flujo OTP
      localStorage.removeItem("senaf_otp_email");
      sessionStorage.removeItem("senaf_otp_flow");
      sessionStorage.removeItem("senaf_pwreset_token");
      sessionStorage.removeItem("senaf_otp_mustChange");
    } catch {}

    if (variant === "mobile" && typeof onCloseMobile === "function") {
      onCloseMobile();
    }

    navigate(ROUTE_LOGIN, { replace: true });
  }

  async function handleAlert() {
    if (typeof onSendAlert === "function") {
      await onSendAlert();
      if (variant === "mobile" && typeof onCloseMobile === "function") {
        onCloseMobile();
      }
      return;
    }

    let gps = null;

    try {
      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              gps = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
              };
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
    } catch {}

    try {
      await rondasqrApi.panic(gps);

      emitLocalPanic({
        source: "rondas_action_panel",
        user: "",
      });

      window.alert("🚨 Alerta de pánico enviada.");

      if (variant === "mobile" && typeof onCloseMobile === "function") {
        onCloseMobile();
      }

      navigate(ROUTE_RONDAS_SCAN);
    } catch {
      window.alert(
        "No se pudo enviar la alerta. Revisa conexión e intenta de nuevo."
      );
    }
  }

  function handleMsg() {
    if (variant === "mobile" && typeof onCloseMobile === "function") {
      onCloseMobile();
    }
    navigate(ROUTE_INCIDENTE_NUEVO);
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
          <AlertTriangle size={18} />
          <span className="text-[15px] leading-none">Enviar Alerta</span>
        </button>

        <button type="button" onClick={handleMsg} className={itemBase}>
          <MessageSquare size={18} />
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
          <LogOut size={18} />
          <span className="text-[15px] leading-none">Salir</span>
        </button>
      </div>
    </aside>
  );
}