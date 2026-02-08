  // src/modules/rondasqr/supervisor/MessagesTable.jsx
  import React from "react";

  function badgeColor(type) {
    const t = (type || "").toLowerCase();
    switch (t) {
      case "panic":
      case "pánico":
        return "bg-red-600/20 text-red-300 border-red-600/40";
      case "fall":
        return "bg-orange-600/20 text-orange-300 border-orange-600/40";
      case "inactivity":
      case "immobility":
        return "bg-yellow-600/20 text-yellow-200 border-yellow-600/40";
      case "noncompliance":
        return "bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-600/40";
      default:
        return "bg-slate-600/20 text-slate-200 border-slate-600/40";
    }
  }

  // host de API para evidencias (sin slash final)
  const API_HOST = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(
    /\/$/,
    ""
  );

  /**
   * items: alertas / mensajes
   * title: título de la sección (por defecto "Mensajes / Incidentes")
   * resolveOfficer?: función opcional (registro) => etiqueta de oficial
   */
  export default function MessagesTable({
    items = [],
    title = "Mensajes / Incidentes",
    resolveOfficer,
  }) {
    const rows = Array.isArray(items) ? items : [];

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-lg">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        {!rows.length ? (
          <div className="text-sm text-white/70">No hay mensajes.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1080px] text-sm">
              <thead className="text-white/80">
                <tr className="border-b border-white/10">
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
                      : m.gpsText ||
                        m.coordinates ||
                        m.location ||
                        "—";

                  const extra =
                    m.type === "inactivity" || m.type === "immobility"
                      ? ` (${m.durationMin ?? "?"} min, pasos ${
                          m.stepsAtAlert ?? "-"
                        })`
                      : m.type === "fall"
                      ? ` (pasos ${m.stepsAtAlert ?? "-"})`
                      : "";

                  // puede venir como photos o evidencias, nos cubrimos
                  const photos = Array.isArray(m.photos)
                    ? m.photos
                    : Array.isArray(m.evidencias)
                    ? m.evidencias
                    : [];

                  return (
                    <tr
                      key={m._id || i}
                      className="border-b border-white/10 last:border-0"
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
                      <td className="py-2 pr-4 align-top">{fecha}</td>
                      <td className="py-2 pr-4 align-top">
                        {m.siteName || m.site || "—"}
                      </td>
                      <td className="py-2 pr-4 align-top">
                        {m.roundName || m.round || "—"}
                      </td>
                      <td className="py-2 pr-4 align-top">{who}</td>
                      <td className="py-2 pr-4 align-top">
                        {(m.text ||
                          m.message ||
                          m.description ||
                          "—") + extra}
                      </td>
                      <td className="py-2 pr-4 align-top">{gps}</td>

                      {/* Evidencias */}
                      <td className="py-2 pr-4 align-top">
                        {photos.length ? (
                          <div className="flex gap-2">
                            {photos.slice(0, 3).map((p, idx) => {
                              const raw =
                                typeof p === "string" ? p : p.path || p.url || "";
                              if (!raw) return null;

                              // si ya viene con http/https no le toco el prefijo
                              const src =
                                raw.startsWith("http://") ||
                                raw.startsWith("https://")
                                  ? raw
                                  : `${API_HOST}${
                                      raw.startsWith("/") ? "" : "/"
                                    }${raw}`;

                              return (
                                <a
                                  key={idx}
                                  href={src}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block w-14 h-14 rounded overflow-hidden border border-white/10 bg-black/30"
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
                              <span className="text-xs text-white/60 self-center">
                                +{photos.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-white/40">—</span>
                        )}
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
