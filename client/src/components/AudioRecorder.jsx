import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, MessageSquare, LogOut } from "lucide-react";

import { rondasqrApi } from "../modules/rondasqr/api/rondasqrApi.js";
import { emitLocalPanic } from "../modules/rondasqr/utils/panicBus.js";
import { iamApi } from "../iam/api/iamApi.js";
import { clearToken } from "../lib/api.js";
import { useAuth } from "../pages/auth/AuthProvider.jsx";

const ROUTE_LOGIN =
  String(import.meta.env.VITE_ROUTE_LOGIN || "/login").trim() || "/login";

const ROUTE_RONDAS_SCAN = "/rondasqr/scan";
const ROUTE_INCIDENTE_NUEVO = "/incidentes/nuevo?from=ronda";

const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";
const VISITOR_HINT_KEY = "senaf_is_visitor";

function normalizeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function uniqLower(arr) {
  return Array.from(
    new Set(
      normalizeArray(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeCan(v) {
  if (!v) return {};
  if (typeof v === "object" && !Array.isArray(v)) return v;
  return {};
}

function resolvePrincipal(user) {
  if (!user || typeof user !== "object") return null;

  const base =
    user.user && typeof user.user === "object"
      ? { ...user.user, ...user }
      : { ...user };

  const roles = uniqLower(base.roles);
  const perms = uniqLower(base.perms || base.permissions);
  const can = normalizeCan(base.can);

  return {
    ...base,
    roles,
    perms,
    permissions: perms,
    can,
    superadmin: base?.superadmin === true || base?.isSuperAdmin === true,
    isSuperAdmin: base?.isSuperAdmin === true || base?.superadmin === true,
  };
}

function hasPermLike(principal, key) {
  const perms = uniqLower(principal?.perms || principal?.permissions);
  const wanted = String(key || "").trim().toLowerCase();
  if (!wanted) return false;
  return perms.includes("*") || perms.includes(wanted);
}

function hasCanLike(principal, key) {
  const can = normalizeCan(principal?.can);
  return can?.[key] === true;
}

export default function SidebarGuard({
  variant = "desktop",
  onCloseMobile,
  onSendAlert,
  asGlobal = false,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout, user, hasPerm, isSuperAdmin } = useAuth();
  const principal = useMemo(() => resolvePrincipal(user) || {}, [user]);

  if (asGlobal) return null;

  const canSendPanic =
    isSuperAdmin ||
    hasPerm?.("rondasqr.panic.write") ||
    hasPermLike(principal, "rondasqr.panic.write") ||
    hasPermLike(principal, "rondasqr.panic.send") ||
    hasCanLike(principal, "rondasqr.scan") ||
    hasCanLike(principal, "nav.rondas");

  const canCreateIncident =
    isSuperAdmin ||
    hasPerm?.("incidentes.records.write") ||
    hasPerm?.("incidentes.create") ||
    hasPermLike(principal, "incidentes.records.write") ||
    hasPermLike(principal, "incidentes.create") ||
    hasCanLike(principal, "nav.incidentes");

  async function doLogout() {
    try {
      await iamApi.logout?.();
    } catch {
      // ignore
    }

    try {
      await logout?.();
    } catch {
      // ignore
    }

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
    } catch {
      // ignore
    }

    if (variant === "mobile" && typeof onCloseMobile === "function") {
      onCloseMobile();
    }

    navigate(ROUTE_LOGIN, { replace: true });
  }

  async function handleAlert() {
    if (!canSendPanic) {
      window.alert(
        t("rondas.guard.sidebar.alerts.noPermission", {
          defaultValue: "No tienes permiso para enviar alertas de pánico.",
        })
      );
      return;
    }

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
    } catch {
      // ignore
    }

    try {
      await rondasqrApi.panic(gps);

      emitLocalPanic({
        source: "rondas_action_panel",
        title: t("rondas.guard.sidebar.alerts.panicTitle", {
          defaultValue: "🚨 Alerta de pánico",
        }),
        message: t("rondas.guard.sidebar.alerts.panicSent", {
          defaultValue: "Alerta de pánico enviada",
        }),
        user: principal?.name || principal?.email || "",
      });

      window.alert(
        t("rondas.guard.sidebar.alerts.panicSentWithIcon", {
          defaultValue: "🚨 Alerta de pánico enviada.",
        })
      );

      if (variant === "mobile" && typeof onCloseMobile === "function") {
        onCloseMobile();
      }

      navigate(ROUTE_RONDAS_SCAN);
    } catch {
      window.alert(
        t("rondas.guard.sidebar.alerts.sendFailed", {
          defaultValue:
            "No se pudo enviar la alerta. Revisa conexión e intenta de nuevo.",
        })
      );
    }
  }

  function handleMsg() {
    if (!canCreateIncident) {
      window.alert(
        t("rondas.guard.sidebar.incident.noPermission", {
          defaultValue: "No tienes permiso para crear mensajes/incidentes.",
        })
      );
      return;
    }

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

  const disabledItemStyle = {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--card-solid) 70%, transparent)",
    color: "var(--text-muted)",
    boxShadow: "none",
    opacity: 0.65,
    cursor: "not-allowed",
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
      aria-label={t("rondas.guard.sidebar.ariaLabel", {
        defaultValue: "Acciones del módulo de rondas",
      })}
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
          {t("rondas.guard.sidebar.subtitle", {
            defaultValue: "Rondas de Vigilancia",
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleAlert}
          disabled={!canSendPanic}
          className={itemBase}
          style={canSendPanic ? neutralItemStyle : disabledItemStyle}
          title={
            canSendPanic
              ? t("rondas.guard.sidebar.alerts.send", {
                  defaultValue: "Enviar alerta",
                })
              : t("rondas.guard.sidebar.alerts.noPermissionTitle", {
                  defaultValue: "No tienes permiso para enviar alertas",
                })
          }
        >
          <AlertTriangle
            size={18}
            strokeWidth={2.3}
            style={{ color: "var(--text-muted)" }}
          />
          <span className="text-[15px] font-medium leading-none">
            {t("rondas.guard.sidebar.alerts.send", {
              defaultValue: "Enviar Alerta",
            })}
          </span>
        </button>

        <button
          type="button"
          onClick={handleMsg}
          disabled={!canCreateIncident}
          className={itemBase}
          style={canCreateIncident ? neutralItemStyle : disabledItemStyle}
          title={
            canCreateIncident
              ? t("rondas.guard.sidebar.incident.create", {
                  defaultValue: "Crear incidente",
                })
              : t("rondas.guard.sidebar.incident.noPermissionTitle", {
                  defaultValue: "No tienes permiso para crear incidentes",
                })
          }
        >
          <MessageSquare
            size={18}
            strokeWidth={2.3}
            style={{ color: "var(--text-muted)" }}
          />
          <span className="text-[15px] font-medium leading-none">
            {t("rondas.guard.sidebar.incident.message", {
              defaultValue: "Mensaje Incidente",
            })}
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
          title={t("nav.logout", { defaultValue: "Salir" })}
        >
          <LogOut size={18} strokeWidth={2.3} />
          <span className="text-[15px] font-semibold leading-none">
            {t("nav.logout", { defaultValue: "Salir" })}
          </span>
        </button>
      </div>
    </aside>
  );
}