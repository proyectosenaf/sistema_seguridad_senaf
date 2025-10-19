import React from "react";

function badgeColor(type) {
  switch (type) {
    case "panic":
      return "bg-red-600/20 text-red-300 border-red-600/40";
    case "fall":
      return "bg-orange-600/20 text-orange-300 border-orange-600/40";
    case "inactivity":
      return "bg-yellow-600/20 text-yellow-200 border-yellow-600/40";
    case "noncompliance":
      return "bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-600/40";
    default:
      return "bg-slate-600/20 text-slate-200 border-slate-600/40";
  }
}

export default function MessagesTable({ items = [] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-lg">
      <h3 className="font-semibold text-lg mb-2">Mensajes / Incidentes</h3>
      {!items.length ? (
        <div className="text-sm text-white/70">No hay mensajes.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[900px] text-sm">
            <thead className="text-white/80">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Sitio</th>
                <th className="py-2 pr-4">Ronda</th>
                <th className="py-2 pr-4">Oficial</th>
                <th className="py-2 pr-4">Detalle</th>
                <th className="py-2 pr-4">GPS</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m, i) => {
                const who =
                  m.officerName || m.officerEmail || m.guardName || m.guardEmail || "-";
                const gps =
                  typeof m?.gps?.lat === "number" && typeof m?.gps?.lon === "number"
                    ? `${m.gps.lat.toFixed(6)}, ${m.gps.lon.toFixed(6)}`
                    : "-";
                const extra =
                  m.type === "inactivity"
                    ? ` (${m.durationMin ?? "?"} min, pasos ${m.stepsAtAlert ?? "-"})`
                    : m.type === "fall"
                    ? ` (pasos ${m.stepsAtAlert ?? "-"})`
                    : "";

                return (
                  <tr key={i} className="border-b border-white/10 last:border-0">
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-xs ${badgeColor(
                          m.type
                        )}`}
                      >
                        {m.type || "custom"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{new Date(m.at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{m.siteName || "-"}</td>
                    <td className="py-2 pr-4">{m.roundName || "-"}</td>
                    <td className="py-2 pr-4">{who}</td>
                    <td className="py-2 pr-4">{(m.text || "") + extra}</td>
                    <td className="py-2">{gps}</td>
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
