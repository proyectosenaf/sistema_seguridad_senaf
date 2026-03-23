// src/modules/rondasqr/supervisor/ReportSummary.jsx
import React from "react";

/**
 * stats: [{
 *   site, siteName, round, roundName, day, officer,
 *   puntosRegistrados, pasos,
 *   primeraMarca, ultimaMarca,
 *   duracionText, banner
 * }]
 */
export default function ReportSummary({ stats = [] }) {
  const totals = Array.isArray(stats)
    ? stats.reduce(
        (acc, s) => {
          acc.count += 1;
          acc.puntos += Number(s?.puntosRegistrados || 0);
          acc.pasos += Number(s?.pasos || 0);
          return acc;
        },
        { count: 0, puntos: 0, pasos: 0 }
      )
    : { count: 0, puntos: 0, pasos: 0 };

  const hasStats = Array.isArray(stats) && stats.length > 0;

  if (!hasStats) {
    return (
      <div className="text-sm text-slate-500 dark:text-white/60">
        Sin datos de resumen para los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chips de totales */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Rondas en el rango" value={totals.count} />
        <Kpi label="Puntos registrados" value={totals.puntos} />
        <Kpi label="Pasos acumulados" value={totals.pasos} accent />
      </div>

      {/* Banda amarilla tipo lámina */}
      {stats[0]?.banner && (
        <div className="rounded-md bg-yellow-400 text-black font-medium px-4 py-2 border border-yellow-600/40">
          {stats[0].banner}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-auto">
        <table className="min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 text-slate-500 dark:text-white/80">
              <Th>Fecha</Th>
              <Th>Sitio</Th>
              <Th>Ronda</Th>
              <Th>Oficial</Th>
              <Th>Puntos registrados</Th>
              <Th>Pasos</Th>
              <Th>Primera marca</Th>
              <Th>Última marca</Th>
              <Th>Duración</Th>
            </tr>
          </thead>

          <tbody>
            {stats.map((s, i) => (
              <tr
                key={s._id || `${s.day || "day"}-${s.siteName || s.site || "site"}-${i}`}
                className="border-b border-black/5 dark:border-white/5"
              >
                <Td>{s.day || "—"}</Td>
                <Td>{s.siteName || s.site || "—"}</Td>
                <Td>{s.roundName || s.round || "—"}</Td>
                <Td>{s.officer || "—"}</Td>
                <Td className="text-right">{s.puntosRegistrados ?? "—"}</Td>
                <Td className="text-right">{s.pasos ?? "—"}</Td>
                <Td>{fmtDateTime(s.primeraMarca)}</Td>
                <Td>{fmtDateTime(s.ultimaMarca)}</Td>
                <Td>{s.duracionText || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- subcomponentes ---------- */

function Th({ children }) {
  return (
    <th className="text-left px-3 py-2 whitespace-nowrap uppercase text-xs tracking-wide">
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={`px-3 py-2 align-top whitespace-nowrap text-slate-700 dark:text-white/80 ${className}`}
    >
      {children}
    </td>
  );
}

function Kpi({ label, value, accent = false }) {
  const base =
    "rounded-xl px-3 py-3 border flex flex-col gap-1 bg-slate-50 border-slate-200 " +
    "dark:border-white/10 dark:bg-black/20";
  const accentCls = accent
    ? " border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-400/40"
    : "";

  return (
    <div className={base + accentCls}>
      <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">
        {label}
      </span>
      <span className="text-xl font-semibold text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

/* helper fecha/hora seguro */
function fmtDateTime(d) {
  try {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (!dt || Number.isNaN(dt.getTime())) return "—";
    return (
      dt.toLocaleString?.() ||
      dt.toISOString().slice(0, 19).replace("T", " ")
    );
  } catch {
    return "—";
  }
}