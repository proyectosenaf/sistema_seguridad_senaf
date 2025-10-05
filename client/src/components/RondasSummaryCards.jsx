// client/src/components/RondasSummaryCards.jsx
import React from "react";

/**
 * Muestra los KPIs principales. Si alguna vez quieres que
 * también muestre el desglose (A tiempo / Tarde / Perdidos),
 * pasa includeBreakdown={true}.
 */
export default function RondasSummaryCards({ summary, loading, includeBreakdown = false }) {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };

  // Soporta distintas formas del payload
  const incidents  = n(summary?.incidents ?? summary?.cards?.incidents);
  const totalScans = n(summary?.totalScans ?? summary?.cards?.totalSimple);
  const onTime     = n(summary?.onTime);
  const late       = n(summary?.late);
  const missed     = n(summary?.missed);

  const denom     = onTime + late + missed || totalScans;
  const pctOnTime = denom > 0 ? Math.round((onTime / denom) * 100) : 0;

  const Val = ({ children }) => (
    <div className="text-3xl font-semibold mt-2">{loading ? "…" : children}</div>
  );

  return (
    <>
      {/* KPIs superiores */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Incidentes</div>
          <Val>{incidents}</Val>
        </div>

        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Escaneos en 24h</div>
          <Val>{totalScans}</Val>
        </div>

        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">A tiempo</div>
          <Val>
            {onTime} <span className="text-base text-neutral-400">({pctOnTime}%)</span>
          </Val>
        </div>

        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Tarde / Perdidos</div>
          <Val>
            {late} / {missed}
          </Val>
        </div>
      </div>

      {/* Desglose opcional para no duplicar con el dashboard */}
      {includeBreakdown && (
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
            <div className="text-sm text-neutral-400">A tiempo</div>
            <Val>{onTime}</Val>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
            <div className="text-sm text-neutral-400">Tarde</div>
            <Val>{late}</Val>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
            <div className="text-sm text-neutral-400">Perdidos (missed)</div>
            <Val>{missed}</Val>
          </div>
        </div>
      )}
    </>
  );
}
