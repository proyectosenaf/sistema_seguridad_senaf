// client/src/pages/Rondas/RondasGuardPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { RondasApi as api } from "../../lib/rondasApi.js";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") + "/api/rondas/v1";

function toArray(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  return [];
}

async function jreq(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      // mismo stub que usas en RondasApi para entorno local
      "x-user-id": "guard-demo-1",
      "x-roles": "admin,guard",
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

function hhmmToMinutes(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return NaN;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isPlanActiveNow(plan, now = new Date()) {
  if (!plan?.daysOfWeek || !plan?.startTime) return false;
  const dow = now.getDay(); // 0..6 (Dom..Sáb)
  if (!plan.daysOfWeek.includes(dow)) return false;

  const nowM = now.getHours() * 60 + now.getMinutes();
  const s = hhmmToMinutes(plan.startTime);
  const e = hhmmToMinutes(plan.endTime ?? plan.startTime); // si no hay endTime, igual a startTime

  if (isNaN(s) || isNaN(e)) return false;

  // Diurna: s <= now <= e
  if ((plan.scheduleType || "day") === "day") {
    return nowM >= s && nowM <= e;
  }
  // Nocturna: cruza medianoche -> activo si now >= s (día actual) o now <= e (temprano al día sig.)
  return nowM >= s || nowM <= e;
}

export default function RondasGuardPage() {
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [checkpoints, setCheckpoints] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  const [scanCode, setScanCode] = useState("");
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Cargar zonas
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setErr("");
        const z = await api.listZones();
        const arr = toArray(z);
        if (!cancel) {
          setZones(arr);
          if (!zoneId && arr.length) setZoneId(arr[0]._id);
        }
      } catch (e) {
        if (!cancel) setErr(e?.message || "No se pudieron cargar las zonas");
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Cargar checkpoints + planes de la zona
  useEffect(() => {
    if (!zoneId) { setCheckpoints([]); setPlans([]); setActivePlan(null); return; }
    let cancel = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const [cpsRes, plansRes] = await Promise.all([
          api.zoneCheckpoints(zoneId),
          jreq(`/plans?zoneId=${zoneId}`),
        ]);

        if (!cancel) {
          const cps = toArray(cpsRes);
          const plist = toArray(plansRes);
          setCheckpoints(cps);
          setPlans(plist);

          const now = new Date();
          const act = plist.find(p => p.active !== false && isPlanActiveNow(p, now)) || null;
          setActivePlan(act);
        }
      } catch (e) {
        if (!cancel) setErr(e?.message || "No se pudieron cargar los datos de la zona");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, [zoneId]);

  const zone = useMemo(() => zones.find(z => z._id === zoneId), [zones, zoneId]);

  async function startRound() {
    if (!zoneId) return;
    try {
      setErr("");
      // primero intento con planId (si hay activo)
      if (activePlan?._id) {
        try {
          const res = await jreq("/shifts/start", { method: "POST", body: { zoneId, planId: activePlan._id } });
          const s = res?.data || res;
          setShift(s);
          return;
        } catch {
          // si tu backend no acepta planId aún, hago fallback sin romper
        }
      }
      const res2 = await api.startShift(zoneId);
      const s2 = res2?.data || res2;
      setShift(s2);
    } catch (e) {
      setErr(e?.message || "No se pudo iniciar la ronda");
    }
  }

  async function endRound() {
    if (!shift?._id) return;
    try {
      setErr("");
      await api.endShift(shift._id);
      setShift(null);
    } catch (e) {
      setErr(e?.message || "No se pudo finalizar la ronda");
    }
  }

  async function doScan({ code, checkpoint }) {
    if (!code && !checkpoint) return;
    try {
      setErr("");
      const payload = {
        zoneId,
        shiftId: shift?._id,
        code: code || checkpoint?.code,
        checkpointId: checkpoint?._id,
        planId: activePlan?._id, // si el backend lo aprovecha, mejor
        at: new Date().toISOString(),
      };
      await api.registerScan(payload);
      setScanCode("");
      alert("Escaneo registrado");
    } catch (e) {
      setErr(e?.message || "No se pudo registrar el escaneo");
    }
  }

  return (
    <section className="p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Rondas – Guardia</h1>
          <p className="text-neutral-400">
            Selecciona una zona para iniciar/finalizar ronda y registrar escaneos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
          >
            <option value="" disabled>Seleccione zona…</option>
            {zones.map(z => (
              <option key={z._id} value={z._id}>{z.name}</option>
            ))}
          </select>

          {!shift ? (
            <button
              className="px-3 py-2 rounded-md border border-primary/60 bg-primary/20 hover:bg-primary/30 disabled:opacity-50"
              onClick={startRound}
              disabled={!zoneId}
            >
              Iniciar ronda
            </button>
          ) : (
            <button
              className="px-3 py-2 rounded-md border border-red-700 text-red-200 hover:bg-red-900/20"
              onClick={endRound}
            >
              Finalizar ronda
            </button>
          )}
        </div>
      </header>

      {err && (
        <div className="rounded-xl border border-red-800/40 bg-red-900/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      {/* Info de plan activo */}
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-400">Plan</div>
        {!activePlan ? (
          <div className="text-neutral-300 mt-1">
            No hay un plan activo ahora para <b>{zone?.name || "—"}</b>.
          </div>
        ) : (
          <div className="text-neutral-300 mt-1">
            Plan activo: <b>{activePlan.name}</b> · {activePlan.scheduleType === "night" ? "Nocturno" : "Diurno"} ·{" "}
            {activePlan.startTime}{activePlan.endTime ? `–${activePlan.endTime}` : ""}{" "}
            {Number(activePlan.repeatEveryMinutes) > 0 ? `· cada ${activePlan.repeatEveryMinutes} min` : "· 1 vez/día"}
          </div>
        )}
      </div>

      {/* Estado de ronda */}
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-400">Estado</div>
        <div className="mt-1">
          {!shift ? (
            <span className="text-neutral-300">Sin ronda activa.</span>
          ) : (
            <div className="text-neutral-300">
              Ronda activa en <b>{zone?.name || "—"}</b> · id: <code>{shift._id}</code>
              {activePlan?.name ? <> · plan: <b>{activePlan.name}</b></> : null}
            </div>
          )}
        </div>
      </div>

      {/* Escaneo manual */}
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-400 mb-2">Escanear por código</div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            placeholder="Escribe el código del checkpoint (ej. CP-001)"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
          />
          <button
            className="px-3 py-2 rounded-md border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
            onClick={() => doScan({ code: scanCode.trim() })}
            disabled={!scanCode.trim() || !zoneId}
          >
            Registrar
          </button>
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          También puedes hacer clic en un checkpoint de la lista para escanearlo.
        </div>
      </div>

      {/* Lista de checkpoints */}
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-400 mb-2">
          Checkpoints de {zone?.name || "—"}
        </div>

        {loading ? (
          <div className="text-neutral-400 text-sm">Cargando…</div>
        ) : !checkpoints.length ? (
          <div className="text-neutral-500 text-sm">No hay checkpoints en esta zona.</div>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {checkpoints.map(cp => (
              <li
                key={cp._id}
                className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{cp.name}</div>
                  <div className="text-xs text-neutral-500">{cp.code}</div>
                </div>
                <button
                  className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
                  onClick={() => doScan({ checkpoint: cp })}
                  disabled={!zoneId}
                >
                  Escanear
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
