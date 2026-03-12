// src/pages/Home/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

// ✅ Usa el filtro por ACL (no NAV_SECTIONS directo)
import { getNavSectionsForMe } from "../../config/navConfig.js";

import api, { getToken } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";

// ✅ para obtener el user/me ya hidratado
import { useAuth } from "../auth/AuthProvider.jsx";

import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ShieldCheck,
  Home as HomeIcon,
} from "lucide-react";

/* Mapa de íconos */
const ICONS = {
  home: HomeIcon,
  accesos: DoorOpen,
  rondas: Footprints,
  incidentes: AlertTriangle,
  visitas: Users,
  bitacora: NotebookPen,
  iam: ShieldCheck,
};

/* Badge pill UI */
function Badge({ value }) {
  const v = Number(value || 0);

  return (
    <span
      className="ml-auto inline-flex min-w-[34px] items-center justify-center rounded-[12px] px-2 py-1 text-sm font-extrabold"
      aria-label={`Conteo ${v}`}
      style={{
        background: "color-mix(in srgb, var(--panel) 78%, transparent)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {v}
    </span>
  );
}

function resolvePrincipal(raw) {
  if (!raw || typeof raw !== "object") return null;

  if (raw.user && typeof raw.user === "object") {
    return {
      ...raw.user,
      ...raw,
      can:
        raw.can && typeof raw.can === "object"
          ? raw.can
          : raw.user.can && typeof raw.user.can === "object"
          ? raw.user.can
          : {},
      superadmin:
        raw.superadmin === true ||
        raw.isSuperAdmin === true ||
        raw.user.superadmin === true ||
        raw.user.isSuperAdmin === true,
      isSuperAdmin:
        raw.isSuperAdmin === true ||
        raw.superadmin === true ||
        raw.user.isSuperAdmin === true ||
        raw.user.superadmin === true,
    };
  }

  return {
    ...raw,
    can: raw.can && typeof raw.can === "object" ? raw.can : {},
    superadmin: raw.superadmin === true || raw.isSuperAdmin === true,
    isSuperAdmin: raw.isSuperAdmin === true || raw.superadmin === true,
  };
}

function KpiCard({ title, value, tone = "default" }) {
  const toneMap = {
    default: {
      valueColor: "var(--text)",
      glow: "color-mix(in srgb, #2563eb 10%, transparent)",
    },
    danger: {
      valueColor: "#ef4444",
      glow: "color-mix(in srgb, #ef4444 12%, transparent)",
    },
    info: {
      valueColor: "#3b82f6",
      glow: "color-mix(in srgb, #3b82f6 12%, transparent)",
    },
    success: {
      valueColor: "#22c55e",
      glow: "color-mix(in srgb, #22c55e 12%, transparent)",
    },
    warning: {
      valueColor: "#f59e0b",
      glow: "color-mix(in srgb, #f59e0b 12%, transparent)",
    },
  };

  const ui = toneMap[tone] || toneMap.default;

  return (
    <div
      className="rounded-[20px] p-4 md:p-5"
      style={{
        background: `linear-gradient(
            to bottom right,
            color-mix(in srgb, var(--card) 88%, transparent),
            color-mix(in srgb, ${ui.glow} 42%, var(--card))
          )`,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        backdropFilter: "blur(12px) saturate(130%)",
        WebkitBackdropFilter: "blur(12px) saturate(130%)",
      }}
    >
      <div
        className="text-sm font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </div>

      <div
        className="mt-2 text-3xl font-extrabold tracking-tight"
        style={{ color: ui.valueColor }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Home() {
  const nav = useNavigate();
  const auth = useAuth();
  const { user, isLoading } = auth || {};

  const [incStats, setIncStats] = React.useState({
    total: 0,
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  /* ✅ Fuente principal robusta para ACL: SOLO backend/session */
  const principal = React.useMemo(() => {
    return resolvePrincipal(user);
  }, [user]);

  /* Socket listeners */
  React.useEffect(() => {
    if (!socket) return;

    const onCheck = () => {
      // opcional: refrescar KPIs si llega un evento
    };

    socket.on("rondasqr:check", onCheck);
    socket.on("rondas:check", onCheck);

    return () => {
      socket.off("rondasqr:check", onCheck);
      socket.off("rondas:check", onCheck);
    };
  }, []);

  /* KPIs incidentes (solo si hay token) */
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = getToken() || "";
        if (!token) return;

        const r = await api.get("/incidentes", { params: { limit: 500 } });

        const data = Array.isArray(r.data)
          ? r.data
          : Array.isArray(r.data?.items)
          ? r.data.items
          : [];

        const total = data.length;
        const abiertos = data.filter((i) => i.status === "abierto").length;
        const enProceso = data.filter((i) => i.status === "en_proceso").length;
        const resueltos = data.filter((i) => i.status === "resuelto").length;
        const alta = data.filter((i) => i.priority === "alta").length;

        if (!alive) return;
        setIncStats({ total, abiertos, enProceso, resueltos, alta });
      } catch (err) {
        console.warn("[Home] Error cargando incidentes:", err?.message || err);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ✅ Secciones desde ACL (backend -> can) */
  const SECTIONS = React.useMemo(() => {
    const secs = getNavSectionsForMe(principal) || [];

    const order = ["accesos", "rondas", "iam", "incidentes", "visitas", "bitacora"];
    const rank = (k) => {
      const i = order.indexOf(k);
      return i === -1 ? 999 : i;
    };

    return [...secs].sort((a, b) => rank(a.key) - rank(b.key));
  }, [principal]);

  /* Badges */
  const BADGES = React.useMemo(
    () => ({
      accesos: 0,
      rondas: 0,
      iam: 0,
      incidentes: incStats.total || 0,
      visitas: 0,
      bitacora: 0,
    }),
    [incStats.total]
  );

  if (isLoading) {
    return (
      <div
        className="p-6"
        style={{ color: "var(--text-muted)" }}
      >
        Cargando…
      </div>
    );
  }

  if (!principal) {
    return (
      <div
        className="p-6"
        style={{ color: "var(--text-muted)" }}
      >
        Cargando sesión…
      </div>
    );
  }

  return (
    <div className="layer-content space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        <KpiCard title="Incidentes" value={incStats.total} tone="default" />
        <KpiCard title="Abiertos" value={incStats.abiertos} tone="danger" />
        <KpiCard title="En Proceso" value={incStats.enProceso} tone="info" />
        <KpiCard title="Resueltos" value={incStats.resueltos} tone="success" />
        <KpiCard title="Alta Prioridad" value={incStats.alta} tone="warning" />
      </div>

      {/* Secciones */}
      <div className="mod-card">
        <div className="mod-card__head">
          <div>
            <h2 className="mod-card__title">Secciones</h2>
            <p className="mod-card__sub">
              Acceso rápido a los módulos habilitados para tu usuario.
            </p>
          </div>
        </div>

        <div className="mod-table-wrap pt-4">
          {SECTIONS.length === 0 ? (
            <div
              className="rounded-[16px] p-4 text-sm"
              style={{
                background: "color-mix(in srgb, var(--panel) 72%, transparent)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              No hay secciones habilitadas para tu usuario.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SECTIONS.map((s) => {
                const key = s.key;
                const Icon = ICONS[key] || null;
                const badgeValue = BADGES[key] ?? 0;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => nav(s.path)}
                    className="text-left transition-all duration-150 hover:-translate-y-[1px]"
                    style={{
                      borderRadius: "18px",
                      border: "1px solid var(--border)",
                      background:
                        "color-mix(in srgb, var(--card-solid) 88%, transparent)",
                      color: "var(--text)",
                      boxShadow: "var(--shadow-sm)",
                      padding: "1rem",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {Icon && (
                        <span
                          className="inline-flex h-10 w-10 items-center justify-center rounded-[14px]"
                          style={{
                            background:
                              "color-mix(in srgb, var(--panel) 78%, transparent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <Icon
                            className="h-5 w-5"
                            style={{ color: "var(--text-muted)" }}
                          />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate font-semibold"
                          style={{ color: "var(--text)" }}
                        >
                          {s.label}
                        </div>
                        <div
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Ir a {s.label}
                        </div>
                      </div>

                      <Badge value={badgeValue} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}