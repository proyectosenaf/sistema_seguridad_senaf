// client/src/pages/Rondas/RondasDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { rapi as api } from "../../lib/rondasApi.js";
import RondasSummaryCards from "../../components/RondasSummaryCards.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/* Helpers */
function toIso(d) {
  return new Date(d).toISOString();
}
function rangeToDates(range) {
  const now = Date.now();
  if (range === "24h") return { from: new Date(now - 24 * 3600e3), to: new Date(now) };
  if (range === "7d") return { from: new Date(now - 7 * 24 * 3600e3), to: new Date(now) };
  if (range === "30d") return { from: new Date(now - 30 * 24 * 3600e3), to: new Date(now) };
  return { from: new Date(now - 24 * 3600e3), to: new Date(now) };
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/* Construye un iframe de OpenStreetMap con bbox y marcador central
   (sin dependencias extras) */
function buildOsmEmbed(scans = []) {
  const pts = scans
    .map(s => ({ lat: s?.geo?.lat, lng: s?.geo?.lng }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (!pts.length) {
    // vista al continente si no hay puntos
    return {
      src:
        "https://www.openstreetmap.org/export/embed.html?bbox=-120,-40, -30, 30&layer=mapnik",
      link: "https://www.openstreetmap.org",
    };
  }

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  // acolchonamos un poco el bbox
  const padLat = Math.max(0.01, (maxLat - minLat) * 0.2);
  const padLng = Math.max(0.01, (maxLng - minLng) * 0.2);
  minLat = clamp(minLat - padLat, -85, 85);
  maxLat = clamp(maxLat + padLat, -85, 85);
  minLng = clamp(minLng - padLng, -179, 179);
  maxLng = clamp(maxLng + padLng, -179, 179);

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.lat},${center.lng}`;
  const link = `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=15/${center.lat}/${center.lng}`;
  return { src, link };
}

export default function RondasDashboard() {
  const [range, setRange] = useState("24h"); // 24h | 7d | 30d | custom
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const dates = useMemo(() => {
    if (range !== "custom") return rangeToDates(range);
    const f = customFrom ? new Date(customFrom) : null;
    const t = customTo ? new Date(customTo) : null;
    if (f && t && f <= t) return { from: f, to: t };
    return rangeToDates("24h");
  }, [range, customFrom, customTo]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: s } = await api.get("/reports/summary", {
          params: { from: toIso(dates.from), to: toIso(dates.to) },
        });
        if (!cancel) setSummary(s);

        const { data: z } = await api.get("/zones");
        if (!cancel) setZones(Array.isArray(z) ? z : []);
      } catch (e) {
        if (!cancel) {
          console.error("[RondasDashboard] load error:", e);
          setErr(e?.message || "No se pudo cargar el resumen");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [dates.from, dates.to]);

  // Normaliza los datos para la barra “Rondas por área”
  const barData = useMemo(() => {
    const list = summary?.perArea || [];
    return list.map(x => ({ name: x.zone || x._id || "—", value: x.value || 0 }));
  }, [summary]);

  const scansForMap = summary?.scans || []; // últimos eventos con geo
  const osm = buildOsmEmbed(scansForMap);

  return (
    <section className="p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Rondas – Información General</h1>
          <p className="text-neutral-400">
            Resumen, estadísticas y reportes de las rondas de vigilancia.
          </p>
        </div>

        {/* Filtros de rango */}
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Personalizado…</option>
          </select>

          {range === "custom" && (
            <>
              <input
                type="datetime-local"
                className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
        </div>
      </header>

      {err && (
        <div className="rounded-xl border border-red-800/40 bg-red-900/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      {/* Tarjetas KPI (incidentes, escaneos, on-time, late/missed) */}
      <RondasSummaryCards summary={summary} loading={loading} />

      {/* Cumplimiento por estado */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">A tiempo</div>
          <div className="text-3xl font-semibold mt-2">
            {summary?.onTime ?? (loading ? "…" : 0)}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Tarde</div>
          <div className="text-3xl font-semibold mt-2">
            {summary?.late ?? (loading ? "…" : 0)}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Perdidos (missed)</div>
          <div className="text-3xl font-semibold mt-2">
            {summary?.missed ?? (loading ? "…" : 0)}
          </div>
        </div>
      </div>

      {/* Información de áreas (barra + mapa lado a lado) */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Barra por área */}
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400 mb-2">Rondas por área</div>
          {barData.length === 0 ? (
            <div className="text-neutral-500 text-sm">Sin datos en el rango seleccionado</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Mapa de trazabilidad (OpenStreetMap embebido) */}
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400 mb-2">Trazabilidad de Rondas</div>
          <div className="w-full h-[320px] rounded-lg overflow-hidden border border-neutral-800">
            <iframe
              title="rondas-map"
              src={osm.src}
              style={{ width: "100%", height: "100%", border: 0 }}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            <a className="underline" href={osm.link} target="_blank" rel="noreferrer">
              Ver mapa en OpenStreetMap
            </a>
          </div>
        </div>
      </div>

      {/* Listado simple de áreas (como en tu versión anterior) */}
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-400 mb-2">Información de Áreas</div>
        {!loading && zones?.length === 0 && (
          <div className="text-neutral-500 text-sm">Sin datos en el rango seleccionado</div>
        )}
        {zones?.length > 0 && (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {zones.map((z) => (
              <li key={z._id} className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
                <div className="font-medium">{z.name}</div>
                <div className="text-xs text-neutral-500">{z.code}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
