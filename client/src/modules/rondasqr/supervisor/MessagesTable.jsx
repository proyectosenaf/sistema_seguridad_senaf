// src/modules/rondasqr/supervisor/MessagesTable.jsx
import React from "react";

function badgeColor(type) {
  const t = (type || "").toLowerCase();
  switch (t) {
    case "panic":
    case "pánico":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-600/20 dark:text-red-300 dark:border-red-600/40";
    case "fall":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-600/20 dark:text-orange-300 dark:border-orange-600/40";
    case "inactivity":
    case "immobility":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-600/20 dark:text-yellow-200 dark:border-yellow-600/40";
    case "noncompliance":
      return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-600/20 dark:text-fuchsia-200 dark:border-fuchsia-600/40";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-600/20 dark:text-slate-200 dark:border-slate-600/40";
  }
}

// host de API para evidencias (sin slash final)
const API_HOST = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(
  /\/$/,
  ""
);

/**
 * items: alertas / mensajes
 * title: título de la sección (se ignora visualmente si el padre ya lo pinta)
 * resolveOfficer?: función opcional (registro) => etiqueta de oficial
 */
export default function MessagesTable({
  items = [],
  title = "Mensajes / Incidentes",
  resolveOfficer,
}) {
  const rows = Array.isArray(items) ? items : [];

  if (!rows.length) {
    return (
      <div className="text-sm text-slate-500 dark:text-white/60">
        No hay mensajes.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10 text-slate-500 dark:text-white/80">
            <th className="py-2 pr-4 text-left">Tipo</th>
            <th className="py-2 pr-4 text-left">Fecha</th>
            <th className="py-2 pr-4 text-left">Sitio</th>
            <th className="py-2 pr-4 text-left">Ronda</th>
            <th className="py-2 pr-4 text-left">Oficial</th>
            <th className="py-2 pr-4 text-left">Detalle</th>
            <th className="py-2 pr-4 text-left">GPS</th>
            <th className="py-2 pr-4 text-left">Evidencias</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((m, i) => {
            const who = resolveOfficer
              ? resolveOfficer(m)
              : m.officerLabel ||
                m.officerName ||
                m.officerEmail ||
                m.guardName ||
                m.guardEmail ||
                "—";

            const dateSrc = m.at || m.ts || m.date || m.createdAt;
            const fecha =
              dateSrc && !Number.isNaN(new Date(dateSrc).getTime())
                ? new Date(dateSrc).toLocaleString()
                : "—";

            const gps =
              typeof m?.gps?.lat === "number" &&
              typeof m?.gps?.lon === "number"
                ? `${m.gps.lat.toFixed(6)}, ${m.gps.lon.toFixed(6)}`
                : m.gpsText || m.coordinates || m.location || "—";

            const extra =
              m.type === "inactivity" || m.type === "immobility"
                ? ` (${m.durationMin ?? "?"} min, pasos ${m.stepsAtAlert ?? "-"})`
                : m.type === "fall"
                ? ` (pasos ${m.stepsAtAlert ?? "-"})`
                : "";

            const photos = Array.isArray(m.photos)
              ? m.photos
              : Array.isArray(m.evidencias)
              ? m.evidencias
              : [];

            return (
              <tr
                key={m._id || i}
                className="border-b border-black/5 dark:border-white/5 last:border-0"
              >
                <td className="py-2 pr-4 align-top">
                  <span
                    className={`inline-block px-2 py-0.5 rounded border text-xs ${badgeColor(
                      m.type
                    )}`}
                  >
                    {m.type || "custom"}
                  </span>
                </td>

                <td className="py-2 pr-4 align-top text-slate-700 dark:text-white/80">
                  {fecha}
                </td>

                <td className="py-2 pr-4 align-top text-slate-700 dark:text-white/80">
                  {m.siteName || m.site || "—"}
                </td>

                <td className="py-2 pr-4 align-top text-slate-700 dark:text-white/80">
                  {m.roundName || m.round || "—"}
                </td>

                <td className="py-2 pr-4 align-top text-slate-700 dark:text-white/80">
                  {who}
                </td>

                <td className="py-2 pr-4 align-top text-slate-900 dark:text-white/90">
                  {(m.text || m.message || m.description || "—") + extra}
                </td>

                <td className="py-2 pr-4 align-top text-slate-700 dark:text-white/80">
                  {gps}
                </td>

                <td className="py-2 pr-4 align-top">
                  {photos.length ? (
                    <div className="flex gap-2">
                      {photos.slice(0, 3).map((p, idx) => {
                        const raw =
                          typeof p === "string" ? p : p.path || p.url || "";
                        if (!raw) return null;

                        const src =
                          raw.startsWith("http://") || raw.startsWith("https://")
                            ? raw
                            : `${API_HOST}${raw.startsWith("/") ? "" : "/"}${raw}`;

                        return (
                          <a
                            key={idx}
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-14 h-14 rounded overflow-hidden border border-black/10 bg-white dark:border-white/10 dark:bg-black/30"
                          >
                            <img
                              src={src}
                              alt="evidencia"
                              className="w-full h-full object-cover"
                            />
                          </a>
                        );
                      })}

                      {photos.length > 3 && (
                        <span className="text-xs text-slate-500 dark:text-white/60 self-center">
                          +{photos.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-white/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}