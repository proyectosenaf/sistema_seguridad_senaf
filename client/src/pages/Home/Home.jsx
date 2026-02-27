// src/pages/Home/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { NAV_SECTIONS } from "../../config/navConfig.js";
import api from "../../lib/api.js";
import IamGuard from "../../iam/api/IamGuard.jsx";
import { socket } from "../../lib/socket.js";

import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
  Home as HomeIcon,
} from "lucide-react";

/* Mapa de íconos */
const ICONS = {
  home: HomeIcon,
  accesos: DoorOpen,
  rondas: Footprints,
  rondasqr: Footprints,
  incidentes: AlertTriangle,
  visitas: Users,
  bitacora: NotebookPen,
  supervision: ClipboardList,
  iam: ShieldCheck,
};

/* ==========================================
   Permisos requeridos por sección (anyOf)
   ========================================== */
const PERMS_BY_SECTION = {
  accesos: ["accesos.read", "accesos.write", "accesos.export", "*"],

  // ✅ rondas: permisos + rol guardia
  rondasqr: ["rondasqr.view", "rondasqr.admin", "rondasqr.reports", "guardia", "*"],
  rondas: ["rondasqr.view", "rondasqr.admin", "rondasqr.reports", "guardia", "*"],

  incidentes: ["incidentes.read", "incidentes.create", "incidentes.edit", "incidentes.reports", "*"],
  visitas: ["visitas.read", "visitas.write", "visitas.close", "*"],
  bitacora: ["bitacora.read", "bitacora.write", "bitacora.export", "*"],
  supervision: ["supervision.read", "supervision.create", "supervision.edit", "supervision.reports", "*"],

  // ✅ CORREGIDO: mismos permisos que usa tu IamAdmin/index.jsx
  iam: ["iam.usuarios.gestionar", "iam.roles.gestionar", "*"],
};

/* ===============
   Badge pill UI
   =============== */
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

export default function Home() {
  const nav = useNavigate();

  const [incStats, setIncStats] = React.useState({
    total: 0,
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  /* Socket listeners */
  React.useEffect(() => {
    if (!socket) return;

    const onCheck = () => {
      // opcional: refrescar KPIs si llega un evento
      // refreshIncStats();
    };

    socket.on("rondasqr:check", onCheck);
    socket.on("rondas:check", onCheck);

    return () => {
      socket.off("rondasqr:check", onCheck);
      socket.off("rondas:check", onCheck);
    };
  }, []);

  /* KPIs incidentes */
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
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

  /* Secciones normalizadas */
  const SECTIONS = React.useMemo(() => {
    const base = (NAV_SECTIONS || []).map((s) => {
      if (s.key === "rondas") {
        return { ...s, key: "rondasqr", path: "/rondasqr/scan" };
      }
      if (s.key === "rondasqr") return { ...s, path: "/rondasqr/scan" };
      return s;
    });

    if (!base.some((s) => s.key === "iam")) {
      base.push({ key: "iam", label: "Usuarios y Permisos", path: "/iam/admin" });
    }

    // Orden estable (opcional, pero ayuda consistencia visual)

    const order = [
      "accesos",
      "iam",
      "rondasqr",
      "incidentes",
      "visitas",
      "bitacora",
      "supervision",
    ];
    base.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

    return base;
  }, []);

  /* Badges */
  const BADGES = React.useMemo(
    () => ({
      accesos: 0,
      iam: 0,
      rondasqr: 0,
      supervision: 0,
      incidentes: incStats.total || 0,
      visitas: 0,
      bitacora: 0,
    }),
    [incStats.total]
  );

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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => {
            const key = s.key;
            const Icon = ICONS[key] || null;
            const badgeValue = BADGES[key] ?? 0;

            return (
              <IamGuard key={key} section={key} fallback={null}>
                <button onClick={() => nav(s.path)} className="fx-tile text-left p-4">
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 opacity-80" />}
                    <div className="font-medium">{s.label}</div>
                    <Badge value={badgeValue} />
                  </div>
                  <div className="text-xs mt-1 opacity-70">Ir a {s.label}</div>
                </button>
              </IamGuard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
