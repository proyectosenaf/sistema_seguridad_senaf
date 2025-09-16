// client/src/pages/Bitacora/Bitacora.jsx
import React from "react";
import axios from "axios";
import { io } from "socket.io-client";
import dayjs from "dayjs";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const SOCKET_URL = API.replace(/\/api\/?$/, "");

const levels = {
  info:  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  warn:  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  error: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  audit: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export default function Bitacora() {
  const [items, setItems] = React.useState([]);
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [modulo, setModulo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const api = React.useMemo(() => axios.create({ baseURL: API }), []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bitacora", { params: { q, level, modulo, limit: 100 } });
      setItems(data.items);
    } finally { setLoading(false); }
  }, [api, q, level, modulo]);

  React.useEffect(() => { load(); }, [load]);

  // Suscripción en tiempo real
  React.useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket"] });
    const onNew = (entry) => {
      // prepend sin perder filtro actual (si no coincide con filtros, lo ignoras)
      if (level && entry.level !== level) return;
      if (modulo && entry.modulo !== modulo) return;
      if (q && !`${entry.mensaje} ${entry.accion} ${entry.modulo}`.toLowerCase().includes(q.toLowerCase())) return;
      setItems((prev) => [entry, ...prev].slice(0, 200));
    };
    s.on("bitacora:new", onNew);
    return () => { s.off("bitacora:new", onNew); s.disconnect(); };
  }, [q, level, modulo]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>e.key==="Enter"&&load()}
          placeholder="Buscar mensaje, acción o módulo…"
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 w-[min(480px,92vw)]"
        />
        <select value={level} onChange={e=>setLevel(e.target.value)} className="px-3 py-2 rounded-lg border">
          <option value="">Nivel (todos)</option>
          <option value="audit">Audit</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <select value={modulo} onChange={e=>setModulo(e.target.value)} className="px-3 py-2 rounded-lg border">
          <option value="">Módulo (todos)</option>
          <option value="incidentes">Incidentes</option>
          <option value="rondas">Rondas</option>
          <option value="accesos">Accesos</option>
          <option value="visitas">Visitas</option>
          <option value="bitacora">Bitácora</option>
          <option value="auth">Auth</option>
        </select>
        <button onClick={load} className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800">Actualizar</button>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-12 text-xs px-3 py-2 bg-neutral-50 dark:bg-neutral-900/40">
          <div className="col-span-2">Fecha</div>
          <div className="col-span-1">Nivel</div>
          <div className="col-span-2">Módulo</div>
          <div className="col-span-2">Acción</div>
          <div className="col-span-3">Mensaje</div>
          <div className="col-span-2">Usuario</div>
        </div>

        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {loading && <div className="p-4 text-sm opacity-70">Cargando…</div>}
          {!loading && items.length === 0 && <div className="p-4 text-sm opacity-70">Sin registros.</div>}

          {items.map((e) => (
            <div key={e._id || e.ts}
              className="grid grid-cols-12 px-3 py-2 text-sm hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
              <div className="col-span-2 tabular-nums">{dayjs(e.ts || e.createdAt).format("YYYY-MM-DD HH:mm:ss")}</div>
              <div className="col-span-1">
                <span className={`px-2 py-0.5 rounded text-xs ${levels[e.level] || levels.info}`}>
                  {e.level}
                </span>
              </div>
              <div className="col-span-2">{e.modulo}</div>
              <div className="col-span-2">{e.accion}</div>
              <div className="col-span-3 truncate" title={e.mensaje}>{e.mensaje}</div>
              <div className="col-span-2 truncate" title={e.usuario || ""}>{e.usuario || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
