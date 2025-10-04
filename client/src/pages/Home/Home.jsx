// client/src/pages/Home/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { io } from "socket.io-client";
import { NAV_SECTIONS } from "../../config/navConfig.js";
import api, { setAuthToken } from "../../lib/api.js";

import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ClipboardList,
  // BarChart3, // no se usa
} from "lucide-react";

// ---------- Normaliza API y SOCKET_URL ----------
const RAW_API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const API_BASE =
  typeof RAW_API === "string" && RAW_API.trim()
    ? RAW_API.trim()
    : "http://localhost:4000/api";
const API_NORM = /\/api\/?$/.test(API_BASE)
  ? API_BASE
  : API_BASE.replace(/\/+$/, "") + "/api";
// Base para socket (sin /api al final)
const SOCKET_URL = API_NORM.replace(/\/api\/?$/, "");

// ---------- Mapa de íconos ----------
const ICONS = {
  accesos: DoorOpen,
  rondas: Footprints,
  incidentes: AlertTriangle,
  visitas: Users,
  bitacora: NotebookPen,
  evaluacion: ClipboardList,
  supervision: ClipboardList,
};

export default function Home() {
  const nav = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [incStats, setIncStats] = React.useState({ total: 0, abiertos: 0, alta: 0 });

  // Ref para mantener una sola instancia de socket (evita duplicados con HMR)
  const socketRef = React.useRef(null);

  // -------- Socket.IO (solo 1 vez) --------
  React.useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      });
    }
    const socket = socketRef.current;

    const onCheck = (evt) => {
      // Aquí puedes actualizar KPIs en caliente si quieres
      // console.log("[rondas:check]", evt);
    };

    socket.on("rondas:check", onCheck);

    return () => {
      socket.off("rondas:check", onCheck);
      // Si quieres cerrar el socket al desmontar, descomenta:
      // socket.close();
    };
  }, []);

  // -------- Token para axios --------
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

  // -------- KPIs de incidentes --------
  React.useEffect(() => {
    (async () => {
      try {
        // ✅ tu API corre bajo /api
        const r = await api.get("/api/incidentes", { params: { limit: 100 } });
        const items = Array.isArray(r.data) ? r.data : r.data?.items || [];
        setIncStats({
          total: items.length,
          abiertos: items.filter((i) => i.estado !== "cerrado").length,
          alta: items.filter((i) => i.prioridad === "alta").length,
        });
      } catch {
        // Silencioso en Home
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* KPIs */}
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

      {/* Secciones */}
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
