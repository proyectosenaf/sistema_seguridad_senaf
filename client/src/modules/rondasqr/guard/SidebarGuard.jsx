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

function resolvePrincipal(user) {
  if (!user || typeof user !== "object") return null;

  if (user.user && typeof user.user === "object") {
    return {
      ...user.user,
      can:
        user?.can && typeof user.can === "object"
          ? user.can
          : user?.user?.can && typeof user.user.can === "object"
          ? user.user.can
          : {},
      superadmin:
        user?.superadmin === true ||
        user?.isSuperAdmin === true ||
        user?.user?.superadmin === true ||
        user?.user?.isSuperAdmin === true,
    };
  }

  return {
    ...user,
    can: user?.can && typeof user.can === "object" ? user.can : {},
    superadmin: user?.superadmin === true || user?.isSuperAdmin === true,
  };
}

export default function SidebarGuard({
  variant = "desktop", // "desktop" | "mobile"
  onCloseMobile,
  onSendAlert,
  asGlobal = false,
}) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const principal = resolvePrincipal(user) || {};

  if (asGlobal) return null;

  async function doLogout() {
    try {
      await iamApi.logout?.();
    } catch {}

    try {
      await logout?.();
    } catch {}

    try {
      clearToken();

      localStorage.removeItem("token");
      localStorage.removeItem("access_token");

      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(VISITOR_HINT_KEY);

      sessionStorage.removeItem(RETURN_TO_KEY);

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
        title: "🚨 Alerta de pánico",
        message: "Alerta de pánico enviada",
        user: principal?.name || principal?.email || "",
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
      ? "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto overscroll-contain p-4 md:hidden"
      : "flex w-64 flex-col overflow-y-auto overscroll-contain p-4";

  const sectionCardStyle = {
    background: "color-mix(in srgb, var(--card) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(14px) saturate(130%)",
    WebkitBackdropFilter: "blur(14px) saturate(130%)",
  };

  const itemBase =
    "w-full flex items-center gap-3 px-4 py-3 rounded-[18px] text-left transition-all duration-150";

  const neutralItemStyle = {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm)",
  };

  const dangerItemStyle = {
    border: "1px solid color-mix(in srgb, #ef4444 28%, var(--border))",
    background: "color-mix(in srgb, #ef4444 10%, var(--card-solid))",
    color: "#dc2626",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <aside
      className={containerBase}
      aria-label="Acciones del módulo de rondas"
      style={sectionCardStyle}
    >
      <div className="mb-5 px-1">
        <div
          className="text-2xl font-extrabold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          SENAF
        </div>
        <div
          className="mt-1 text-xs font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--text-muted)" }}
        >
          Rondas de Vigilancia
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleAlert}
          className={itemBase}
          style={neutralItemStyle}
        >
          <AlertTriangle
            size={18}
            strokeWidth={2.3}
            style={{ color: "var(--text-muted)" }}
          />
          <span className="text-[15px] font-medium leading-none">
            Enviar Alerta
          </span>
        </button>

        <button
          type="button"
          onClick={handleMsg}
          className={itemBase}
          style={neutralItemStyle}
        >
          <MessageSquare
            size={18}
            strokeWidth={2.3}
            style={{ color: "var(--text-muted)" }}
          />
          <span className="text-[15px] font-medium leading-none">
            Mensaje Incidente
          </span>
        </button>
      </div>

      <div className="mt-auto pt-4">
        <div
          className="mb-3"
          style={{ borderTop: "1px solid var(--border)" }}
        />

        <button
          type="button"
          onClick={doLogout}
          className={itemBase}
          style={dangerItemStyle}
        >
          <LogOut size={18} strokeWidth={2.3} />
          <span className="text-[15px] font-semibold leading-none">Salir</span>
        </button>
      </div>
    </aside>
  );
}
