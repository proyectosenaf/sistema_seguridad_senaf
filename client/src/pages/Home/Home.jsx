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
      className={[
        "ml-auto inline-flex items-center justify-center",
        "min-w-[34px] h-7 px-2",
        "rounded-xl text-sm font-extrabold",
        "bg-slate-500/20 text-slate-200",
        "ring-1 ring-white/10",
      ].join(" ")}
      aria-label={`Conteo ${v}`}
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
    return <div className="p-6">Cargando…</div>;
  }

  if (!principal) {
    return <div className="p-6">Cargando sesión…</div>;
  }

  return (
    <div className="space-y-6 layer-content">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Incidentes</div>
          <div className="text-3xl font-extrabold">{incStats.total}</div>
        </div>
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Abiertos</div>
          <div className="text-3xl font-extrabold text-red-400">{incStats.abiertos}</div>
        </div>
        <div className="fx-kpi">
          <div className="text-sm opacity-75">En Proceso</div>
          <div className="text-3xl font-extrabold text-blue-400">{incStats.enProceso}</div>
        </div>
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Resueltos</div>
          <div className="text-3xl font-extrabold text-green-400">{incStats.resueltos}</div>
        </div>
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Alta Prioridad</div>
          <div className="text-3xl font-extrabold text-yellow-400">{incStats.alta}</div>
        </div>
      </div>

      {/* Secciones */}
      <div className="fx-card">
        <h2 className="font-semibold mb-3">Secciones</h2>

        {SECTIONS.length === 0 ? (
          <div className="p-4 text-sm opacity-80">
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
                  className="fx-tile text-left p-4"
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 opacity-80" />}
                    <div className="font-medium">{s.label}</div>
                    <Badge value={badgeValue} />
                  </div>
                  <div className="text-xs mt-1 opacity-70">Ir a {s.label}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}