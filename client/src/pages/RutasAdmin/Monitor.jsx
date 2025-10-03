// client/src/pages/RutasAdmin/Monitor.jsx
import React from "react";
import { io } from "socket.io-client";
import RondasAPI from "/src/lib/rondasApi.js";

// Deriva la URL base de API y Socket (raíz sin /api)
const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");
const SOCKET_URL = API_BASE.replace(/\/api$/, "");
const socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: true });

function useBeep() {
  // Beep soft para eventos late/invalid (WebAudio API, sin archivos)
  const refCtx = React.useRef(null);
  const beep = React.useCallback((frequency = 880, durationMs = 100, type = "sine") => {
    try {
      const ctx = refCtx.current || new (window.AudioContext || window.webkitAudioContext)();
      refCtx.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = frequency;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      o.stop(ctx.currentTime + durationMs / 1000 + 0.01);
    } catch {
      // silencio si el navegador bloquea audio
    }
  }, []);
  return beep;
}

export default function MonitorRondas() {
  const [routes, setRoutes] = React.useState([]);
  const [items, setItems] = React.useState([]); // shifts activos
  const [eventsByShift, setEventsByShift] = React.useState({}); // shiftId => [ev,...]
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // filtros
  const [routeFilter, setRouteFilter] = React.useState("");
  const [guardQuery, setGuardQuery] = React.useState("");

  // UI
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [showTimeline, setShowTimeline] = React.useState({}); // shiftId => bool

  const beep = useBeep();

  const pct = (s) => {
    const expected = Number(s.expectedCount ?? 0);
    const done = Number(s.metrics?.completedCount ?? 0);
    if (!expected) return 0;
    return Math.min(100, Math.round((done / expected) * 100));
  };
  const okCount = (s) => Math.max(0, Number(s.metrics?.completedCount ?? 0) - Number(s.metrics?.lateCount ?? 0));

  const loadAll = React.useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [rs, shifts] = await Promise.all([
        RondasAPI.getRoutes(),
        RondasAPI.getRondasActivas(),
      ]);
      setRoutes(Array.isArray(rs) ? rs : []);
      setItems(Array.isArray(shifts) ? shifts : []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Error cargando monitor");
    } finally {
      setLoading(false);
    }
  }, []);

  // primera carga
  React.useEffect(() => { loadAll(); }, [loadAll]);

  // autorefresco de respaldo (30s)
  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadAll, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, loadAll]);

  // Sockets
  React.useEffect(() => {
    const onShiftStarted = () => {
      RondasAPI.getRondasActivas().then((list) => setItems(Array.isArray(list) ? list : []));
    };
    const onShiftFinished = (payload) => {
      const finishedId = payload?.id || payload?._id;
      if (!finishedId) return;
      setItems((prev) => prev.filter((s) => String(s._id) !== String(finishedId)));
    };
    const onCheck = (ev) => {
      // Normaliza
      const sid = ev.shiftId || ev.shift || ev.shift_id || ev.id;
      if (!sid) return;

      // Beep si late o invalid
      if (ev.result === "late") beep(660, 120, "triangle");
      else if (ev.result === "invalid") beep(440, 160, "square");

      // agrega a timeline visual (máximo 30 eventos por shift)
      setEventsByShift((prev) => ({
        ...prev,
        [sid]: [ev, ...(prev[sid] || [])].slice(0, 30),
      }));

      // Ajuste optimista de métricas en tarjeta
      setItems((prev) =>
        prev.map((s) => {
          if (String(s._id) !== String(sid)) return s;
          const m = { ...(s.metrics || { completedCount: 0, lateCount: 0, invalidCount: 0, score: 0 }) };
          if (ev.result === "ok") m.completedCount += 1;
          else if (ev.result === "late") { m.completedCount += 1; m.lateCount += 1; }
          else if (ev.result === "invalid") m.invalidCount += 1;
          return { ...s, metrics: m };
        })
      );
    };

    socket.on("rondas:shift-started", onShiftStarted);
    socket.on("rondas:shift-finished", onShiftFinished);
    socket.on("rondas:check", onCheck);

    return () => {
      socket.off("rondas:shift-started", onShiftStarted);
      socket.off("rondas:shift-finished", onShiftFinished);
      socket.off("rondas:check", onCheck);
    };
  }, [beep]);

  // filtros de vista
  const filtered = React.useMemo(() => {
    return items.filter((s) => {
      if (routeFilter && String(s.routeId || s.route?._id) !== String(routeFilter)) return false;
      if (guardQuery) {
        const q = guardQuery.toLowerCase();
        const guardName = (s.guard?.name || s.guardName || "").toLowerCase();
        const guardExt = (s.guard?.externalId || s.guardExternalId || s.guardId || "").toLowerCase();
        if (!guardName.includes(q) && !guardExt.includes(q)) return false;
      }
      return true;
    });
  }, [items, routeFilter, guardQuery]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="text-2xl font-semibold">Monitor de Rondas</div>
        <div className="flex items-center gap-2">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={autoRefresh}
              onChange={(e)=>setAutoRefresh(e.target.checked)}
            />
            Autorefresco 30s
          </label>
          <button
            onClick={loadAll}
            className="px-3 py-1.5 rounded border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
            title="Actualizar ahora"
          >
            Refrescar
          </button>
        </div>
      </div>

      {err && (
        <div className="p-3 rounded bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100">
          {err}
        </div>
      )}

      {/* Filtros */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <div className="text-sm opacity-70 mb-1">Ruta</div>
          <select
            className="w-full border rounded p-2 bg-transparent"
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {routes.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <div className="text-sm opacity-70 mb-1">Buscar guardia</div>
          <input
            className="w-full border rounded p-2 bg-transparent"
            placeholder="Por nombre o externalId"
            value={guardQuery}
            onChange={(e) => setGuardQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tarjetas de shifts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="opacity-60">Cargando rondas activas…</div>
        ) : filtered.length === 0 ? (
          <div className="opacity-60">No hay rondas activas con los filtros actuales.</div>
        ) : (
          filtered.map((s) => (
            <div key={s._id} className="p-4 rounded-2xl border dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/40 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    Shift #{String(s._id).slice(-6)}{" "}
                    {s.route?.name && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-neutral-800/30">
                        {s.route.name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs opacity-70 truncate">
                    Guardia: {s.guard?.name || s.guardName || s.guard?.externalId || s.guardExternalId || s.guardId} · Inicio:{" "}
                    {s.startedAt ? new Date(s.startedAt).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs opacity-70">Esperados: {s.expectedCount ?? "?"}</div>
                  <div className="text-xs opacity-70">OK: {okCount(s)} · Tarde: {s.metrics?.lateCount ?? 0} · Inválidos: {s.metrics?.invalidCount ?? 0}</div>
                </div>
              </div>

              {/* Progreso */}
              <div className="mt-3">
                <div className="text-sm opacity-80 mb-1">
                  Progreso · {okCount(s) + (s.metrics?.lateCount || 0)}/{s.expectedCount} ({pct(s)}%)
                </div>
                <div className="h-2 rounded bg-neutral-700/30 overflow-hidden">
                  <div className="h-2 bg-neutral-100/70" style={{ width: `${pct(s)}%` }} />
                </div>
              </div>

              {/* Acciones */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
                  onClick={() => setShowTimeline((p) => ({ ...p, [s._id]: !p[s._id] }))}
                >
                  {showTimeline[s._id] ? "Ocultar eventos" : "Ver eventos"}
                </button>
              </div>

              {/* Timeline */}
              {showTimeline[s._id] && (
                <div className="mt-3 rounded-lg border dark:border-neutral-800 p-3">
                  {(eventsByShift[s._id] || []).length === 0 ? (
                    <div className="text-sm opacity-70">Sin eventos recibidos aún. Se llenará en vivo.</div>
                  ) : (
                    <ul className="space-y-1">
                      {(eventsByShift[s._id] || []).map((ev, i) => {
                        const ts = new Date(ev.ts || ev.scannedAt || Date.now());
                        const badge =
                          ev.result === "ok" ? "bg-emerald-600/70" :
                          ev.result === "late" ? "bg-amber-600/70" :
                          "bg-rose-600/70";
                        return (
                          <li key={i} className="flex items-center gap-3">
                            <span className="text-xs opacity-60 w-16">{ts.toLocaleTimeString()}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${badge}`}>
                              {ev.result}
                            </span>
                            <span className="opacity-80">
                              {ev.cpCode || ev.checkpointCode} · {ev.checkpoint?.name || ev.cpName || "-"}
                            </span>
                            {typeof ev.latencySec === "number" && (
                              <span className="opacity-60 text-xs">(+{ev.latencySec}s)</span>
                            )}
                            {ev.method && (
                              <span className="opacity-60 text-xs ml-auto">{ev.method}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
