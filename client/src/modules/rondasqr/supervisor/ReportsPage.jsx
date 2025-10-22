// src/modules/rondasqr/supervisor/ReportsPage.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi";
import ReportSummary from "./ReportSummary";
import OmissionsTable from "./OmissionsTable";
import MessagesTable from "./MessagesTable";
import DetailedMarks from "./DetailedMarks";
import MapView from "./MapView";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  // ⚠️ Usa `officer` (el backend espera ese nombre exacto)
  const [f, setF] = useState({
    from: today(),
    to: today(),
    siteId: "",
    roundId: "",
    officer: "",
  });

  const [data, setData] = useState({
    stats: [],
    omissions: [],
    messages: [],
    detailed: [],
  });

  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const s = await rondasqrApi.getSummary(f);
      const d = await rondasqrApi.getDetailed(f);
      setData({
        stats: s?.stats || [],
        omissions: s?.omissions || [],
        messages: s?.messages || [],
        detailed: d?.items || [],
      });
    } catch (e) {
      console.warn("[ReportsPage] load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (k) => (e) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Cinta de título */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl px-5 py-4 shadow-lg">
        <h1 className="text-2xl font-semibold tracking-wide">Informes</h1>
        <p className="opacity-90 text-sm">
          Resumen de rondas, omisiones e incidentes
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-lg">
        <div className="grid md:grid-cols-6 gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-xs text-white/70 mb-1">Desde</label>
            <input
              type="date"
              value={f.from}
              onChange={setField("from")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-white/70 mb-1">Hasta</label>
            <input
              type="date"
              value={f.to}
              onChange={setField("to")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-white/70 mb-1">
              Sitio (opcional)
            </label>
            <input
              placeholder="ID del sitio"
              value={f.siteId}
              onChange={setField("siteId")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-white/70 mb-1">
              Ronda (opcional)
            </label>
            <input
              placeholder="ID de ronda"
              value={f.roundId}
              onChange={setField("roundId")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-white/70 mb-1">
              Oficial (opcional)
            </label>
            <input
              placeholder="correo / nombre"
              value={f.officer}
              onChange={setField("officer")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow disabled:opacity-70"
              disabled={loading}
            >
              {loading ? "Consultando…" : "Consultar"}
            </button>

            {/* Export: usa el mismo objeto de filtros */}
            <a
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20"
              href={rondasqrApi.csvUrl(f)}
              target="_blank"
              rel="noreferrer"
            >
              CSV
            </a>
            <a
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20"
              href={rondasqrApi.kmlUrl(f)}
              target="_blank"
              rel="noreferrer"
            >
              KML
            </a>
          </div>
        </div>
      </div>

      {/* Secciones de reporte */}
      <ReportSummary stats={data.stats} />
      <OmissionsTable items={data.omissions} />
      <MessagesTable items={data.messages} />

      <DetailedMarks items={data.detailed} />

      {/* Mapa embebido (vista rápida) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-lg">
        <h3 className="font-semibold text-lg mb-2">Mapa</h3>
        <MapView items={data.detailed} />
      </div>
    </div>
  );
}
