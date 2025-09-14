import React from "react";
import { NAV_SECTIONS } from "../../config/navConfig";
import { useNavigate } from "react-router-dom";
import { api, setAuthToken } from "../../lib/api";
import { useAuth0 } from "@auth0/auth0-react";
import { DoorOpen, Footprints, AlertTriangle, Users, NotebookPen, ClipboardList, BarChart3 } from "lucide-react";

const ICONS = {
  accesos: DoorOpen,
  rondas: Footprints,
  incidentes: AlertTriangle,
  visitas: Users,
  bitacora: NotebookPen,
  evaluacion: ClipboardList,
  reportes: BarChart3,
  supervision: ClipboardList,
};

export default function Home() {
  const nav = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [incStats, setIncStats] = React.useState({ total: 0, abiertos: 0, alta: 0 });

  React.useEffect(() => {
    setAuthToken(() =>
      getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      })
    );
  }, [getAccessTokenSilently]);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/incidentes", { params: { limit: 100 } });
        const items = Array.isArray(r.data) ? r.data : (r.data.items || []);
        setIncStats({
          total: items.length,
          abiertos: items.filter(i => i.estado !== "cerrado").length,
          alta: items.filter(i => i.prioridad === "alta").length,
        });
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* KPIs con efecto suave y legible */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Incidentes</div>
          <div className="text-3xl font-extrabold">{incStats.total}</div>
        </div>
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Abiertos</div>
          <div className="text-3xl font-extrabold">{incStats.abiertos}</div>
        </div>
        <div className="fx-kpi">
          <div className="text-sm opacity-75">Alta prioridad</div>
          <div className="text-3xl font-extrabold">{incStats.alta}</div>
        </div>
      </div>

      {/* Secciones con borde FX (sólo esta tarjeta) */}
      <div className="card fx-card">
        <h2 className="font-semibold mb-3">Secciones</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_SECTIONS.map((s) => {
            const Icon = ICONS[s.key];
            return (
              <button
                key={s.key}
                onClick={() => nav(s.path)}
                className="fx-tile text-left p-4"
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon className="w-5 h-5 opacity-80" />}
                  <div className="font-medium">{s.label}</div>
                </div>
                <div className="text-xs mt-1 opacity-70">Ir a {s.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// Página de inicio con KPIs y accesos rápidos a seccione