import React from "react";
import { io } from "socket.io-client";
import { RondasAPI, baseURL } from "../../lib/rondasApi";

function computeSocketUrl() {
  try {
    const api = new URL(baseURL); // ej: http://localhost:4000/api
    return `${api.protocol}//${api.host}`; // -> http://localhost:4000
  } catch {
    const u = new URL(window.location.origin);
    if (u.port === "3000" || u.port === "5173") u.port = "4000";
    return `${u.protocol}//${u.host}`;
  }
}
const SOCKET_URL = computeSocketUrl();

export default function Rondas() {
  const [routes, setRoutes] = React.useState([]);  // siempre array
  const [active, setActive] = React.useState([]);  // siempre array
  const [events, setEvents] = React.useState([]);
  const [selectedRoute, setSelectedRoute] = React.useState("");
  const [guardId, setGuardId] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, a] = await Promise.all([RondasAPI.getRoutes(), RondasAPI.getActive()]);
        if (!alive) return;
        setRoutes(Array.isArray(r) ? r : []);
        setActive(Array.isArray(a) ? a : []);
      } catch (e) {
        if (!alive) return;
        setError(String(e.message || e));
      }
    })();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    let s;
    try {
      s = io(SOCKET_URL, { transports: ["websocket"], timeout: 2500 });
      const onCheck  = (p) => setEvents((prev) => [p, ...prev].slice(0, 50));
      const refresh  = () => RondasAPI.getActive().then((a) => setActive(Array.isArray(a) ? a : []));
      s.on("rondas:check", onCheck);
      s.on("rondas:shift-started", refresh);
      s.on("rondas:shift-finished", refresh);
    } catch {
      // si el servidor no está, no rompemos la UI
    }
    return () => { try { s?.disconnect(); } catch {} };
  }, []);

  const start = async () => {
    setError("");
    try {
      if (!selectedRoute || !guardId) throw new Error("Selecciona ruta y guardia");
      await RondasAPI.startShift(selectedRoute, guardId);
      setGuardId("");
      setActive(await RondasAPI.getActive());
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const finish = async (id) => {
    setError("");
    try {
      await RondasAPI.finishShift(id);
      setActive(await RondasAPI.getActive());
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border dark:border-neutral-800">
          <div className="text-sm opacity-70 mb-2">Iniciar ronda</div>
          <select
            className="w-full border rounded p-2 mb-2"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            <option value="">Selecciona ruta…</option>
            {routes.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
          <input
            className="w-full border rounded p-2 mb-3"
            placeholder="ID del guardia (sub/email)"
            value={guardId}
            onChange={(e) => setGuardId(e.target.value)}
          />
          <button
            onClick={start}
            className="w-full rounded bg-emerald-600 text-white py-2 hover:bg-emerald-700"
          >
            Iniciar
          </button>
        </div>

        <div className="p-4 rounded-xl border dark:border-neutral-800 md:col-span-2">
          <div className="text-sm opacity-70 mb-2">Rondas activas</div>
          <div className="space-y-2">
            {active.length === 0 && <div className="opacity-60 text-sm">Sin rondas activas</div>}
            {active.map((s) => (
              <div key={s._id} className="flex items-center justify-between gap-3 p-3 rounded-lg border dark:border-neutral-800">
                <div>
                  <div className="font-medium">Shift #{String(s._id).slice(-6)}</div>
                  <div className="text-xs opacity-70">Guardia: {s.guardId} · Inició: {new Date(s.startedAt).toLocaleString()}</div>
                </div>
                <div className="text-sm opacity-80">Puntos: {s.completedCount}/{s.expectedCount}</div>
                <button onClick={() => finish(s._id)} className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700">
                  Finalizar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stream en vivo */}
      <div className="p-4 rounded-xl border dark:border-neutral-800">
        <div className="text-sm opacity-70 mb-2">Eventos (en vivo)</div>
        <div className="grid grid-cols-12 text-xs px-2 py-1 bg-neutral-50 dark:bg-neutral-900/40 rounded">
          <div className="col-span-3">Hora</div>
          <div className="col-span-2">Guardia</div>
          <div className="col-span-3">Checkpoint</div>
          <div className="col-span-2">Método</div>
          <div className="col-span-2">Resultado</div>
        </div>
        <div className="divide-y dark:divide-neutral-800">
          {events.map((e, i) => (
            <div key={i} className="grid grid-cols-12 px-2 py-1 text-sm">
              <div className="col-span-3">{new Date(e.ts).toLocaleString()}</div>
              <div className="col-span-2">{e.guardId}</div>
              <div className="col-span-3">{e.checkpointCode} · {e.checkpoint?.name}</div>
              <div className="col-span-2">{e.method}</div>
              <div className="col-span-2">{e.result}</div>
            </div>
          ))}
          {events.length === 0 && <div className="p-3 text-sm opacity-60">Sin eventos todavía.</div>}
        </div>
      </div>
    </div>
  );
}
