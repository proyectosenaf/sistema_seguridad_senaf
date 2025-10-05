import React from "react";

function lastStatusFor(cpId, scans = []) {
  const s = scans
    .filter(x => String(x.checkpoint?._id || x.checkpoint) === String(cpId))
    .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))[0];
  return s?.status || "pending"; // pending = aún sin escaneo
}

function etaInfo(cp, shift) {
  // Si no hay programación, no mostramos ETA
  if (!shift?.startedAt || typeof cp?.expectedSecondsFromStart !== "number") {
    return { label: null, overdue: false };
  }
  const start = new Date(shift.startedAt).getTime();
  const expectedAt = start + cp.expectedSecondsFromStart * 1000;
  const now = Date.now();
  const diffMs = expectedAt - now; // >0 = falta; <0 = ya pasó
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  const label = diffMs >= 0 ? `en ${absMin}m` : `hace ${absMin}m`;

  const grace = Number(cp.graceSeconds ?? 60) * 1000;
  const overdue = now > (expectedAt + grace);
  return { label, overdue };
}

export default function RondasPatrolHUD({
  shift,
  checkpoints = [],
  scans = [],
  onEnd,
  onIncident,
}) {
  // Resumen de estados por checkpoint (según último scan)
  const stats = checkpoints.reduce(
    (acc, cp) => {
      const st = lastStatusFor(cp._id, scans);
      if (st === "on_time") acc.onTime++;
      else if (st === "late") acc.late++;
      else if (st === "missed") acc.missed++;
      else acc.pending++;
      return acc;
    },
    { onTime: 0, late: 0, missed: 0, pending: 0 }
  );

  const hasShift = Boolean(shift?._id);

  return (
    <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {hasShift ? `Turno #${String(shift._id).slice(-6)}` : "Sin turno activo"}
          </div>
          <div className="text-sm text-neutral-400">
            Estado: {shift?.status || "—"}{" "}
            {shift?.startedAt && (
              <span className="ml-2 opacity-70">
                Inicio: {new Date(shift.startedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Resumen compacto */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="px-2 py-1 rounded-lg border border-neutral-800">
            <div className="text-neutral-400">A tiempo</div>
            <div className="font-semibold">{stats.onTime}</div>
          </div>
          <div className="px-2 py-1 rounded-lg border border-neutral-800">
            <div className="text-neutral-400">Tarde</div>
            <div className="font-semibold">{stats.late}</div>
          </div>
          <div className="px-2 py-1 rounded-lg border border-neutral-800">
            <div className="text-neutral-400">Perdidos</div>
            <div className="font-semibold">{stats.missed}</div>
          </div>
          <div className="px-2 py-1 rounded-lg border border-neutral-800">
            <div className="text-neutral-400">Pend.</div>
            <div className="font-semibold">{stats.pending}</div>
          </div>
        </div>
      </div>

      {/* Lista de checkpoints */}
      <div className="mt-3 grid gap-1 text-sm">
        {checkpoints.map((cp) => {
          const st = lastStatusFor(cp._id, scans);
          const { label: etaLabel, overdue } = etaInfo(cp, shift);

          const badge =
            st === "on_time"
              ? "text-emerald-400"
              : st === "late"
              ? "text-amber-400"
              : st === "missed"
              ? "text-red-400"
              : overdue // pending pero ya vencido por ETA+gracia
              ? "text-red-400"
              : "text-neutral-400";

          const statusText =
            st !== "pending"
              ? st
              : overdue
              ? "overdue"
              : "pending";

          return (
            <div key={cp._id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>• {cp.name}</span>
                {typeof cp.expectedSecondsFromStart === "number" && (
                  <span className="text-[11px] text-neutral-500">
                    {etaLabel ? `(${etaLabel})` : ""}
                  </span>
                )}
              </div>
              <span className={badge}>{statusText}</span>
            </div>
          );
        })}
        {checkpoints.length === 0 && (
          <div className="text-neutral-500">No hay checkpoints en este turno.</div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
          onClick={onEnd}
          disabled={!hasShift}
          type="button"
        >
          Finalizar turno
        </button>
        <button
          className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
          onClick={onIncident}
          disabled={!hasShift}
          type="button"
        >
          Reportar incidente
        </button>
      </div>
    </div>
  );
}
