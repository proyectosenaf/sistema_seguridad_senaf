// src/modules/rondasqr/supervisor/OmissionsTable.jsx
import React from "react";

// mismo helper de fecha que usamos en ReportsPage
function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/**
 * items: array de omisiones
 * resolveOfficer?: función opcional (registro) => etiqueta de oficial
 */
export default function OmissionsTable({ items = [], resolveOfficer }) {
  const rows = Array.isArray(items) ? items : [];

  if (rows.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-white/60">
        No hay omisiones para los filtros actuales.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10 text-xs uppercase tracking-wide text-slate-500 dark:text-white/70">
            <th className="px-3 py-2 text-center w-16">#</th>
            <th className="px-3 py-2 text-left">Ronda</th>
            <th className="px-3 py-2 text-center">Fecha/Hora esperada</th>
            <th className="px-3 py-2 text-left">Punto</th>
            <th className="px-3 py-2 text-left">Oficial</th>
            <th className="px-3 py-2 text-center w-32">Estado</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((o, i) => {
            const fecha = formatDateTime(
              o.expectedAt || o.expectedTime || o.date || o.ts
            );
            const ronda = o.roundName || o.round || o.roundId || "—";
            const punto = o.pointName || o.point || o.pointId || "—";

            const oficial = resolveOfficer
              ? resolveOfficer(o)
              : o.officerLabel ||
                o.officerName ||
                o.guardName ||
                o.officerEmail ||
                o.guardEmail ||
                o.guardId ||
                "—";

            return (
              <tr
                key={o._id || i}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="px-3 py-2 text-center text-slate-700 dark:text-white/80">
                  {i + 1}
                </td>
                <td className="px-3 py-2 text-slate-900 dark:text-white/90">
                  {ronda}
                </td>
                <td className="px-3 py-2 text-center text-slate-700 dark:text-white/80">
                  {fecha}
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-white/80">
                  {punto}
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-white/80">
                  {oficial}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-400/90 dark:text-slate-900">
                    Omitido
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}