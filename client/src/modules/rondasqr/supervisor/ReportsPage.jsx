// src/modules/rondasqr/supervisor/ReportsPage.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi";
import ReportSummary from "./ReportSummary";
import OmissionsTable from "./OmissionsTable";
import MessagesTable from "./MessagesTable";
import DetailedMarks from "./DetailedMarks";
import MapView from "./MapView";

const ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* =============== helpers para banner suave ================= */
function hexToRgba(hex, a = 0.16) {
  if (!hex) return `rgba(0,0,0,${a})`;
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c.slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function readVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* fecha/hora segura para evitar "Invalid Date" en exportaciones */
function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
/* =========================================================== */

export default function ReportsPage() {
  // Filtros (el backend espera la clave 'officer')
  const [f, setF] = useState({
    from: today(),
    to: today(),
    siteId: "",
    roundId: "",
    officer: "",
    // tipo de reporte
    reportType: "all", // all | rounds | omissions | messages | detail | map
    // qué secciones incluir
    includeSummary: true,
    includeOmissions: true,
    includeMessages: true,
    includeDetail: true,
    includeMap: true,
  });

  const [data, setData] = useState({
    stats: [],
    omissions: [],
    messages: [],
    detailed: [],
  });

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Catálogos para selects
  const [sites, setSites] = useState([]);
  const [rounds, setRounds] = useState([]);

  // Cargar sitios al montar
  useEffect(() => {
    (async () => {
      try {
        const s = await rondasqrApi.listSites();
        setSites(s?.items || []);
      } catch (e) {
        console.warn("[ReportsPage] listSites error:", e);
      }
    })();
  }, []);

  // Cargar rondas cuando cambia siteId
  useEffect(() => {
    (async () => {
      if (!f.siteId) {
        setRounds([]);
        setF((prev) => ({ ...prev, roundId: "" }));
        return;
      }
      try {
        const r = await rondasqrApi.listRounds(f.siteId);
        setRounds(r?.items || []);
      } catch (e) {
        console.warn("[ReportsPage] listRounds error:", e);
      }
    })();
  }, [f.siteId]);

  async function load() {
    setLoading(true);
    try {
      // Se envían todos los filtros; el backend puede ignorar los nuevos si no los soporta
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

  // carga inicial
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  function resetOptionalFilters() {
    setF((prev) => ({
      ...prev,
      siteId: "",
      roundId: "",
      officer: "",
    }));
    setRounds([]);
  }

  function handleToggleInclude(key) {
    setF((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleReportTypeChange(type) {
    // Ajusta automáticamente qué secciones se incluyen según el tipo
    setF((prev) => {
      if (type === "all") {
        return {
          ...prev,
          reportType: type,
          includeSummary: true,
          includeOmissions: true,
          includeMessages: true,
          includeDetail: true,
          includeMap: true,
        };
      }
      if (type === "omissions") {
        return {
          ...prev,
          reportType: type,
          includeSummary: false,
          includeOmissions: true,
          includeMessages: false,
          includeDetail: false,
          includeMap: false,
        };
      }
      if (type === "messages") {
        return {
          ...prev,
          reportType: type,
          includeSummary: false,
          includeOmissions: false,
          includeMessages: true,
          includeDetail: false,
          includeMap: false,
        };
      }
      if (type === "detail") {
        return {
          ...prev,
          reportType: type,
          includeSummary: false,
          includeOmissions: false,
          includeMessages: false,
          includeDetail: true,
          includeMap: false,
        };
      }
      if (type === "map") {
        return {
          ...prev,
          reportType: type,
          includeSummary: false,
          includeOmissions: false,
          includeMessages: false,
          includeDetail: false,
          includeMap: true,
        };
      }
      // "rounds" u otros: resumen + detalle (y mapa opcional)
      return {
        ...prev,
        reportType: type,
        includeSummary: true,
        includeOmissions: false,
        includeMessages: false,
        includeDetail: true,
        includeMap: true,
      };
    });
  }

  /* ---------- Exportar helper: encabezados y dataset de omisiones ---------- */

  // Nombre legible de sitio/ronda para encabezados
  const siteLabel =
    f.siteId && sites.length
      ? sites.find((s) => String(s._id) === String(f.siteId))?.name || "Sitio seleccionado"
      : "Todos";

  const roundLabel =
    f.roundId && rounds.length
      ? rounds.find((r) => String(r._id) === String(f.roundId))?.name || "Ronda seleccionada"
      : "Todas";

  // dataset de omisiones a exportar (ya viene filtrado por backend según f)
  const omissionsToExport = data.omissions || [];

  function exportOmissionsPdf() {
    const rows = omissionsToExport;
    const win = window.open("", "_blank");
    const fechaHora = new Date();

    const style = `
      <style>
        @page { margin: 16mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body{
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          margin:0; color:#0f172a;
        }
        header{
          padding:4px 0 12px 0;
          margin-bottom:8px;
          border-bottom:2px solid #e2e8f0;
        }
        .brand{
          font-weight:900;
          font-size:26px;
          margin:0 0 2px 0;
          letter-spacing:.12em;
          text-transform:uppercase;
        }
        .title{
          font-size:20px;
          font-weight:800;
          margin:4px 0 2px 0;
        }
        .subtitle{
          font-size:13px;
          margin:0;
          color:#475569;
        }
        .meta{
          font-size:11px;
          margin-top:6px;
          color:#64748b;
        }
        h2.section{
          font-size:17px;
          font-weight:800;
          margin:16px 0 8px;
        }
        table{
          width:100%;
          border-collapse:separate;
          border-spacing:0;
          font-size:11px;
        }
        thead th{
          background:#0f172a;
          color:#f9fafb;
          font-weight:700;
          text-align:left;
          padding:6px 8px;
          border-right:1px solid #111827;
        }
        thead th:first-child{border-top-left-radius:10px;}
        thead th:last-child{border-top-right-radius:10px;border-right:none;}
        tbody td{
          padding:6px 8px;
          border-bottom:1px solid #e2e8f0;
          border-right:1px solid #e2e8f0;
        }
        tbody td:last-child{border-right:none;}
        tbody tr:nth-child(even) td{background:#f9fafb;}
        .chip{
          display:inline-block;
          padding:2px 8px;
          border-radius:999px;
          background:#fbbf24;
          color:#1f2937;
          font-size:10px;
          font-weight:600;
        }
        footer{
          position:fixed;
          bottom:12mm;
          left:0; right:0;
          text-align:center;
          color:#94a3b8;
          font-size:11px;
        }
        table, tr, td, th { page-break-inside: avoid; }
      </style>
    `;

    const headerHtml = `
      <header>
        <div class="brand">Seguridad SENAF</div>
        <div class="title">Informe de Omisiones de Rondas</div>
        <p class="subtitle">Rondas omitidas dentro del rango seleccionado</p>
        <div class="meta">
          <div><b>Rango:</b> ${f.from || "—"} — ${f.to || "—"}</div>
          <div><b>Sitio:</b> ${siteLabel} · <b>Ronda:</b> ${roundLabel}</div>
          <div><b>Oficial:</b> ${f.officer || "Todos"}</div>
          <div><b>Generado:</b> ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}</div>
          <div><b>Total omisiones:</b> ${rows.length}</div>
        </div>
      </header>
    `;

    const headerRow = `
      <tr>
        <th>#</th>
        <th>Ronda</th>
        <th>Fecha/Hora esperada</th>
        <th>Punto</th>
        <th>Oficial</th>
        <th>Estado</th>
      </tr>
    `;

    const bodyRows = rows
      .map((o, i) => {
        const fecha = formatDateTime(
          o.expectedAt || o.expectedTime || o.date || o.ts
        );
        const ronda = o.roundName || o.roundId || "—";
        const punto = o.pointName || o.point || o.pointId || "—";
        const oficial = o.officerName || o.officerEmail || o.guardId || "—";

        return `
          <tr>
            <td>${i + 1}</td>
            <td>${ronda}</td>
            <td>${fecha}</td>
            <td>${punto}</td>
            <td>${oficial}</td>
            <td><span class="chip">Omitido</span></td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8" />${style}</head>
        <body>
          ${headerHtml}

          <h2 class="section">Detalle de omisiones</h2>

          <table>
            <thead>${headerRow}</thead>
            <tbody>${bodyRows}</tbody>
          </table>

          <footer>Generado por el módulo de Rondas QR — Seguridad SENAF</footer>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  function exportOmissionsExcel() {
    const rows = omissionsToExport;
    const fechaHora = new Date();

    const style = `
      <style>
        body { font-family: Calibri, "Segoe UI", Arial, sans-serif; }
        .brand { font-size:20px; font-weight:800; margin:4px 0 2px 0; text-transform:uppercase; letter-spacing:.12em; }
        .subtitle { font-size:14px; font-weight:700; margin:0 0 6px 0; }
        .meta { margin:4px 0 8px 0; font-size:11px; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        thead th{
          background:#0f172a; color:#fff; text-align:left; padding:6px;
          border:1px solid #0f172a; font-weight:700;
        }
        tbody td{ padding:5px; border:1px solid #e5e7eb; }
        tbody tr:nth-child(even){ background:#f9fafb; }
      </style>
    `;

    const resumenHtml = `
      <div class="meta">
        <div><b>Rango:</b> ${f.from || "—"} — ${f.to || "—"}</div>
        <div><b>Sitio:</b> ${siteLabel} · <b>Ronda:</b> ${roundLabel}</div>
        <div><b>Oficial:</b> ${f.officer || "Todos"}</div>
        <div><b>Generado:</b> ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}</div>
        <div><b>Total omisiones:</b> ${rows.length}</div>
      </div>
    `;

    const header = ["#", "Ronda", "Fecha/Hora esperada", "Punto", "Oficial", "Estado"];

    const body = rows
      .map((o, i) => {
        const fecha = formatDateTime(
          o.expectedAt || o.expectedTime || o.date || o.ts
        );
        const ronda = o.roundName || o.roundId || "—";
        const punto = o.pointName || o.point || o.pointId || "—";
        const oficial = o.officerName || o.officerEmail || o.guardId || "—";
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${ronda}</td>
            <td>${fecha}</td>
            <td>${punto}</td>
            <td>${oficial}</td>
            <td>Omitido</td>
          </tr>
        `;
      })
      .join("");

    const table = `
      <table>
        <thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    `;

    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/>${style}</head>
      <body>
        <div class="brand">Seguridad SENAF</div>
        <div class="subtitle">Informe de Omisiones de Rondas</div>
        ${resumenHtml}
        ${table}
      </body></html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omisiones-${f.from || "desde"}_${f.to || "hasta"}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Exportar (backend + overrides para omisiones) ---------- */
  async function openFirstOk(urls) {
    for (const url of urls) {
      try {
        const ok = await rondasqrApi.ping(url);
        if (ok) {
          window.open(url, "_blank", "noreferrer");
          return true;
        }
      } catch {
        // ignore
      }
    }
    return false;
  }

  async function doExcel() {
    // Si el usuario está en modo "Omisiones", exportamos el dataset filtrado
    if (f.reportType === "omissions") {
      exportOmissionsExcel();
      return;
    }

    try {
      setDownloading(true);
      const qs = new URLSearchParams(f).toString();
      const candidates = [
        rondasqrApi.xlsxUrl(f),
        `${ROOT}/api/rondasqr/v1/reports/export/xlsx?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/xlsx?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/excel?${qs}`,
      ];
      const ok = await openFirstOk(candidates);
      if (!ok) alert("HTTP 404 - No se encontró endpoint de Excel. Verifica la ruta en el servidor.");
    } finally {
      setDownloading(false);
    }
  }

  async function doPdf() {
    // Si el usuario está en modo "Omisiones", generamos el PDF en el front
    if (f.reportType === "omissions") {
      exportOmissionsPdf();
      return;
    }

    try {
      setDownloading(true);
      const qs = new URLSearchParams(f).toString();
      const candidates = [
        rondasqrApi.pdfUrl(f),
        `${ROOT}/api/rondasqr/v1/reports/pdf?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/export/report.pdf?${qs}`,
      ];
      const ok = await openFirstOk(candidates);
      if (!ok) alert("HTTP 404 - No se encontró endpoint de PDF. Verifica la ruta en el servidor.");
    } finally {
      setDownloading(false);
    }
  }

  function doPrint() {
    // Imprime la vista actual (el encabezado "Seguridad SENAF" ya se muestra arriba)
    window.print();
  }
  /* ----------------------------------- */

  // Banner suave: toma variables del tema
  const fromVar = readVar("--accent-from", "#38bdf8");
  const toVar = readVar("--accent-to", "#22d3ee");
  const alphaVar = parseFloat(readVar("--accent-alpha", "0.16")) || 0.16;
  const bannerStyle = {
    background: `linear-gradient(90deg, ${hexToRgba(fromVar, alphaVar)} 0%, ${hexToRgba(
      toVar,
      alphaVar
    )} 100%)`,
  };

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Encabezado */}
      <div className="rounded-xl px-4 py-3 md:px-5 md:py-4" style={bannerStyle}>
        <p className="text-[11px] md:text-xs font-semibold tracking-[0.18em] uppercase text-white/70">
          Seguridad SENAF
        </p>
        <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
          Informes
        </h1>
        <p className="opacity-90 text-sm md:text-base">
          Resumen de rondas, omisiones e incidentes
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-3 shadow-lg space-y-3">
        {/* Fila 1: Tipo de reporte + acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-white/70 uppercase tracking-wide">
              Tipo de reporte
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "Todos" },
                { id: "rounds", label: "Rondas" },
                { id: "omissions", label: "Omisiones" },
                { id: "messages", label: "Mensajes / Incidentes" },
                { id: "detail", label: "Detalle" },
                { id: "map", label: "Mapa" },
              ].map((opt) => {
                const active = f.reportType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleReportTypeChange(opt.id)}
                    className={[
                      "px-3 py-1.5 rounded-full text-[11px] border transition",
                      active
                        ? "bg-emerald-500 text-black border-emerald-400 shadow"
                        : "bg-black/30 border-white/15 text-white/80 hover:border-emerald-400/70 hover:text-emerald-200",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm shadow disabled:opacity-70"
              disabled={loading}
            >
              {loading ? "Consultando…" : "Consultar"}
            </button>

            <button
              type="button"
              onClick={resetOptionalFilters}
              className="px-3 py-1.5 rounded-lg border border-white/20 bg-black/30 text-white/80 text-xs hover:bg-white/10"
            >
              Limpiar filtros
            </button>

            <button
              type="button"
              onClick={doPdf}
              disabled={downloading}
              className="px-3 py-1.5 rounded-lg border border-white/20 bg-black/30 text-white text-xs hover:bg-white/10 disabled:opacity-70"
            >
              {downloading ? "PDF…" : "PDF"}
            </button>

            <button
              type="button"
              onClick={doExcel}
              disabled={downloading}
              className="px-3 py-1.5 rounded-lg border border-white/20 bg-black/30 text-white text-xs hover:bg-white/10 disabled:opacity-70"
            >
              {downloading ? "Excel…" : "Excel"}
            </button>

            <button
              type="button"
              onClick={doPrint}
              className="px-3 py-1.5 rounded-lg border border-white/20 bg-black/30 text-white text-xs hover:bg-white/10"
            >
              Imprimir
            </button>
          </div>
        </div>

        {/* Fila 2: filtros principales */}
        <div className="grid md:grid-cols-5 gap-2 items-end">
          <div className="flex flex-col">
            <label className="text-[11px] text-white/70 mb-1">Desde</label>
            <input
              type="date"
              value={f.from}
              onChange={setField("from")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-white/70 mb-1">Hasta</label>
            <input
              type="date"
              value={f.to}
              onChange={setField("to")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-white/70 mb-1">Sitio (opcional)</label>
            <select
              value={f.siteId}
              onChange={setField("siteId")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-white/70 mb-1">Ronda (opcional)</label>
            <select
              value={f.roundId}
              onChange={setField("roundId")}
              disabled={!f.siteId}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <option value="">Todas</option>
              {rounds.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-white/70 mb-1">Oficial (opcional)</label>
            <input
              placeholder="correo / nombre / guardId"
              value={f.officer}
              onChange={setField("officer")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Fila 3: qué secciones incluir */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10">
          <span className="text-[11px] text-white/60 uppercase tracking-wide pt-1">
            Incluir en el reporte:
          </span>

          <label className="inline-flex items-center gap-1 text-xs text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={f.includeSummary}
              onChange={() => handleToggleInclude("includeSummary")}
              className="rounded border-white/20 bg-black/60"
            />
            Resumen
          </label>

          <label className="inline-flex items-center gap-1 text-xs text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={f.includeOmissions}
              onChange={() => handleToggleInclude("includeOmissions")}
              className="rounded border-white/20 bg-black/60"
            />
            Omisiones
          </label>

          <label className="inline-flex items-center gap-1 text-xs text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={f.includeMessages}
              onChange={() => handleToggleInclude("includeMessages")}
              className="rounded border-white/20 bg-black/60"
            />
            Mensajes / Incidentes
          </label>

          <label className="inline-flex items-center gap-1 text-xs text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={f.includeDetail}
              onChange={() => handleToggleInclude("includeDetail")}
              className="rounded border-white/20 bg-black/60"
            />
            Detalle
          </label>

          <label className="inline-flex items-center gap-1 text-xs text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={f.includeMap}
              onChange={() => handleToggleInclude("includeMap")}
              className="rounded border-white/20 bg-black/60"
            />
            Mapa
          </label>
        </div>
      </div>

      {/* Secciones de reporte (controladas por flags) */}
      {f.includeSummary && <ReportSummary stats={data.stats} />}
      {f.includeOmissions && <OmissionsTable items={data.omissions} />}
      {f.includeMessages && <MessagesTable items={data.messages} />}
      {f.includeDetail && <DetailedMarks items={data.detailed} />}

      {f.includeMap && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-3 shadow-lg">
          <h3 className="font-semibold text-base mb-2">Mapa</h3>
          <MapView items={data.detailed} />
        </div>
      )}
    </div>
  );
}
