// client/src/pages/Rondas/Rondas.jsx
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  getRoutes,
  getRondasActivas,
  startShift,
  finishShift,
  checkPoint,
} from "/src/lib/rondasApi.js";

// Deriva la URL de socket desde la base de API (quita el sufijo /api)
const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");
const SOCKET_URL = API_BASE.replace(/\/api$/, "");
const socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: true });

export default function Rondas() {
  const [rutas, setRutas] = useState([]);
  const [rondasActivas, setRondasActivas] = useState([]);
  const [rutaSeleccionada, setRutaSeleccionada] = useState("");
  const [idGuardia, setIdGuardia] = useState("");
  const [error, setError] = useState("");

  // UI: ver/ocultar eventos y lista de eventos por ronda
  const [showEvents, setShowEvents] = useState({});
  const [eventsByShift, setEventsByShift] = useState({}); // shiftId => [eventos...]

  // UI: marcaje rápido por ronda
  const [quickCode, setQuickCode] = useState({});     // shiftId => código
  const [quickMethod, setQuickMethod] = useState({}); // shiftId => método

  useEffect(() => {
    let mounted = true;

    const cargar = async () => {
      try {
        const [rutasData, rondasData] = await Promise.all([getRoutes(), getRondasActivas()]);
        if (!mounted) return;
        setRutas(Array.isArray(rutasData) ? rutasData : []);
        setRondasActivas(Array.isArray(rondasData) ? rondasData : []);
      } catch (err) {
        console.error("Error al cargar:", err);
        if (mounted) setError("Error al cargar la información. Revisa la consola.");
      }
    };
    cargar();

    // --- Sockets ---
    const onShiftStarted = () => {
      getRondasActivas().then((list) => mounted && setRondasActivas(Array.isArray(list) ? list : []));
    };
    const onShiftFinished = (payload) => {
      const finishedId = payload?.id || payload?._id;
      if (!finishedId) return;
      if (!mounted) return;
      setRondasActivas((prev) => prev.filter((s) => String(s._id) !== String(finishedId)));
    };
    const onCheck = (ev) => {
      const sid = ev.shiftId || ev.shift || ev.shift_id;
      if (!sid || !mounted) return;

      // prepend a la lista visible de eventos (máx 20 por ronda)
      setEventsByShift((prev) => ({
        ...prev,
        [sid]: [ev, ...(prev[sid] || [])].slice(0, 20),
      }));

      // Ajuste optimista de métricas en la tarjeta (el servidor también actualiza)
      setRondasActivas((prev) =>
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
      mounted = false;
      socket.off("rondas:shift-started", onShiftStarted);
      socket.off("rondas:shift-finished", onShiftFinished);
      socket.off("rondas:check", onCheck);
    };
  }, []);

  const handleIniciarRonda = async (e) => {
    e.preventDefault();
    setError("");
    if (!rutaSeleccionada || !idGuardia) {
      setError("Por favor, selecciona una ruta y escribe el ID del guardia.");
      return;
    }
    try {
      const shift = await startShift({
        routeId: rutaSeleccionada,
        guardExternalId: idGuardia,
      });
      setRondasActivas((prev) => [shift, ...prev]);
      setRutaSeleccionada("");
      setIdGuardia("");
    } catch (err) {
      console.error("Error al iniciar:", err);
      setError(err?.response?.data?.error || err.message || "Error al iniciar la ronda.");
    }
  };

  const handleFinish = async (id) => {
    setError("");
    try {
      await finishShift(id);
      setRondasActivas((prev) => prev.filter((s) => String(s._id) !== String(id)));
    } catch (err) {
      console.error("Error al finalizar:", err);
      setError(err?.response?.data?.error || err.message || "Error al finalizar la ronda.");
    }
  };

  const doQuickMark = async (shift) => {
    setError("");
    const code = (quickCode[shift._id] || "").trim();
    const method = quickMethod[shift._id] || "manual"; // permitido: manual | qr | nfc | finger
    if (!code) return;

    try {
      await checkPoint(shift._id, { cpCode: code, method });
      setQuickCode((p) => ({ ...p, [shift._id]: "" }));
      // El socket actualizará métricas y eventos en vivo
    } catch (err) {
      console.error("Marcaje error:", err);
      setError(err?.response?.data?.error || err.message || "No se pudo registrar el checkpoint.");
    }
  };

  const pct = (s) => {
    const expected = Number(s.expectedCount ?? 0);
    const done = Number(s.metrics?.completedCount ?? 0);
    if (!expected) return 0;
    return Math.min(100, Math.round((done / expected) * 100));
  };
  const okCount = (s) =>
    Math.max(0, Number(s.metrics?.completedCount ?? 0) - Number(s.metrics?.lateCount ?? 0));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Iniciar ronda */}
        <div className="p-5 rounded-2xl border dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/40 backdrop-blur">
          <div className="text-lg font-semibold mb-3">Iniciar ronda</div>

          <select
            className="w-full border rounded p-2 mb-3 bg-transparent"
            value={rutaSeleccionada}
            onChange={(e) => setRutaSeleccionada(e.target.value)}
          >
            <option value="">Selecciona ruta…</option>
            {rutas.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>

          <input
            className="w-full border rounded p-2 mb-4 bg-transparent"
            placeholder="ID del guardia (externalId/email/sub)"
            value={idGuardia}
            onChange={(e) => setIdGuardia(e.target.value)}
          />

          <button
            onClick={handleIniciarRonda}
            className="w-full rounded bg-emerald-600 text-white py-2 hover:bg-emerald-700"
          >
            Iniciar
          </button>
        </div>

        {/* Rondas activas */}
        <div className="p-5 rounded-2xl border dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/40 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Rondas activas</div>
            <a
              href="/rondas/kiosco"
              className="text-sm underline opacity-80 hover:opacity-100"
              title="Abrir kiosco de marcaje"
            >
              Abrir kiosco
            </a>
          </div>

          <div className="space-y-3">
            {rondasActivas.length ? (
              rondasActivas.map((s) => (
                <div key={s._id} className="p-4 rounded-xl border dark:border-neutral-800 bg-black/5 dark:bg-white/5">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
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
                        Guardia: {s.guard?.externalId || s.guardName || s.guardId} · Inicio:{" "}
                        {s.startedAt ? new Date(s.startedAt).toLocaleString() : "-"}
                      </div>
                    </div>

                    <button
                      onClick={() => handleFinish(s._id)}
                      className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700"
                    >
                      Finalizar
                    </button>
                  </div>

                  {/* Progreso */}
                  <div className="mt-3">
                    <div className="text-sm opacity-80 mb-1">
                      Progreso · {okCount(s) + (s.metrics?.lateCount || 0)}/{s.expectedCount} ({pct(s)}%)
                    </div>
                    <div className="h-2 rounded bg-neutral-700/30 overflow-hidden">
                      <div className="h-2 bg-neutral-100/70" style={{ width: `${pct(s)}%` }} />
                    </div>
                    <div className="mt-1 text-xs opacity-70 flex gap-4">
                      <span>OK: {okCount(s)}</span>
                      <span>Tarde: {s.metrics?.lateCount ?? 0}</span>
                      <span>Inválidos: {s.metrics?.invalidCount ?? 0}</span>
                    </div>
                  </div>

                  {/* Marcaje rápido */}
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <input
                      className="flex-1 min-w-[180px] border rounded p-2 bg-transparent"
                      placeholder="Código de checkpoint"
                      value={quickCode[s._id] || ""}
                      onChange={(e) => setQuickCode((p) => ({ ...p, [s._id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && doQuickMark(s)}
                    />
                    <select
                      className="border rounded p-2 bg-transparent"
                      value={quickMethod[s._id] || "manual"}
                      onChange={(e) => setQuickMethod((p) => ({ ...p, [s._id]: e.target.value }))}
                    >
                      {/* valores permitidos por el backend: manual | qr | nfc | finger */}
                      <option value="manual">Manual</option>
                      <option value="qr">QR</option>
                      <option value="nfc">NFC</option>
                      <option value="finger">Huella</option>
                    </select>
                    <button
                      onClick={() => doQuickMark(s)}
                      className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Marcar
                    </button>
                    <button
                      onClick={() => setShowEvents((p) => ({ ...p, [s._id]: !p[s._id] }))}
                      className="ml-auto px-3 py-2 rounded border dark:border-neutral-700"
                    >
                      {showEvents[s._id] ? "Ocultar eventos" : "Ver eventos"}
                    </button>
                  </div>

                  {/* Eventos recientes */}
                  {showEvents[s._id] && (
                    <div className="mt-3 text-sm rounded-lg border dark:border-neutral-800 p-3">
                      {(eventsByShift[s._id] || []).length === 0 ? (
                        <div className="opacity-70">Sin eventos todavía.</div>
                      ) : (
                        <ul className="space-y-1">
                          {(eventsByShift[s._id] || []).map((ev, i) => (
                            <li key={i} className="flex items-center gap-3">
                              <span className="text-xs opacity-60">
                                {new Date(ev.ts || ev.scannedAt || Date.now()).toLocaleTimeString()}
                              </span>
                              <span className="opacity-80">
                                {ev.cpCode || ev.checkpointCode} · {ev.checkpoint?.name || ev.cpName || "-"}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-700/30">
                                {ev.result}
                              </span>
                              {typeof ev.latencySec === "number" && (
                                <span className="opacity-60 text-xs">(+{ev.latencySec}s)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="opacity-60 text-sm">Sin rondas activas</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
