// src/modules/rondasqr/supervisor/OmissionsTable.jsx
import React from "react";

// mismo helper de fecha que usamos en ReportsPage
function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function OmissionsTable({ items = [], resolveOfficer }) {
  const rows = items || [];

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 backdrop-blur shadow-lg">
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-base font-semibold">Omisiones</h2>
        <p className="text-xs text-white/60">
          Rondas omitidas según los filtros seleccionados
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/60">
          No hay omisiones para los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-xs uppercase tracking-wide text-white/70">
                <th className="px-3 py-2 text-center w-16">#</th>
                <th className="px-3 py-2 text-left">Ronda</th>
                <th className="px-3 py-2 text-center">
                  Fecha/Hora esperada
                </th>
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

                // Si ReportsPage nos manda un resolver, lo usamos
                const oficial = resolveOfficer
                  ? resolveOfficer(o)
                  : o.officerName ||
                    o.guardName ||
                    o.officerEmail ||
                    o.guardEmail ||
                    o.guardId ||
                    "—";

                return (
                  <tr
                    key={o._id || i}
                    className={i % 2 === 0 ? "bg-white/0" : "bg-white/5"}
                  >
                    <td className="px-3 py-2 text-center text-white/80">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 text-white/90">{ronda}</td>
                    <td className="px-3 py-2 text-center text-white/80">
                      {fecha}
                    </td>
                    <td className="px-3 py-2 text-white/80">{punto}</td>
                    <td className="px-3 py-2 text-white/80">{oficial}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/90 text-slate-900">
                        Omitido
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
