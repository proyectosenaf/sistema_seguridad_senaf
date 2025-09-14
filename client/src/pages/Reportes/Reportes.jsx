import React from "react";
import { api } from "../../lib/api.js";

/* ============================
   Módulos
============================ */
const MODULOS = [
  { value: "incidentes",  label: "Incidentes" },
  { value: "visitas",     label: "Visitas" },
  { value: "rondas",      label: "Rondas de Vigilancia" },
  { value: "supervision", label: "Supervisión" },
  { value: "evaluacion",  label: "Evaluación" },
  { value: "accesos",     label: "Control de Acceso" },
];

const SEDES_FALLBACK = ["", "Sede Central", "Sucursal Sur", "Sucursal Norte"];

/* ============================
   Utils
============================ */
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
};
const toISODate = (d) => d.toISOString().slice(0, 10);

/* dd/mm/aaaa <-> ISO */
const isoToDisplay = (iso) => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
};
const displayToISO = (txt) => {
  if (!txt) return null;
  const m = txt.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  d  = d.padStart(2, "0");
  mo = mo.padStart(2, "0");
  y  = y.length === 2 ? `20${y}` : y;
  const test = new Date(`${y}-${mo}-${d}T00:00:00`);
  if (Number.isNaN(test.getTime())) return null;
  return `${y}-${mo}-${d}`;
};

/* ============================
   Export helpers
============================ */
function exportCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (s) => {
    if (s == null) return "";
    const str = String(s).replaceAll('"', '""');
    return /,|\n|"/.test(str) ? `"${str}"` : str;
  };
  const content = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function tableHTML(title, cols, rows) {
  const head = cols.map(c => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">${c}</th>`).join("");
  const body = rows.map(r => (
    `<tr>${cols.map(c => `<td style="padding:6px 8px;border-bottom:1px solid #eee">${r[c] ?? ""}</td>`).join("")}</tr>`
  )).join("");
  return `
    <h2 style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:0 0 12px">${title}</h2>
    <table style="border-collapse:collapse;width:100%;font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px">
      <thead style="background:#f6f7f8">${head}</thead>
      <tbody>${body}</tbody>
    </table>`;
}
function exportExcel(filename, title, cols, rows) {
  if (!rows.length) return;
  const html = `<!DOCTYPE html><meta charset="UTF-8">${tableHTML(title, cols, rows)}`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
function exportWord(filename, title, cols, rows) {
  if (!rows.length) return;
  const html = `<!DOCTYPE html><meta charset="UTF-8"><title>${title}</title>${tableHTML(title, cols, rows)}`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".doc") ? filename : `${filename}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(title, cols, rows) {
  if (!rows.length) return;
  const html = `
  <!DOCTYPE html>
  <html><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <style>
      *{box-sizing:border-box}
      body{font:12px system-ui,Segoe UI,Roboto,Arial;padding:24px}
      h1{font-size:18px;margin:0 0 12px}
      table{border-collapse:collapse;width:100%}
      th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
      thead th{border-bottom:1px solid #ddd;background:#f6f7f8}
      @media print{@page{size:A4;margin:16mm}}
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    ${tableHTML("", cols, rows)}
    <script>setTimeout(()=>window.print(),300)</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}

/* ============================
   Proyección / KPIs
============================ */
function projectRow(module, row) {
  switch (module) {
    case "incidentes":
      return { Fecha: fmtDate(row.fecha || row.createdAt || row.inicio), Tipo: row.tipo || row.categoria || "—", Prioridad: row.prioridad || row.priority || "—", Estado: row.estado || row.status || "—", Sede: row.sede || row.ubicacion || row.site || "—" };
    case "visitas":
      return { Fecha: fmtDate(row.horaEntrada || row.createdAt), Nombre: row.nombre || row.name || "—", Documento: row.documento || row.doc || "—", Motivo: row.motivo || row.reason || "—", Estado: row.estado || row.status || "—", Salida: fmtDate(row.horaSalida || row.salida) };
    case "rondas":
      return { Inicio: fmtDate(row.inicio || row.createdAt), Fin: fmtDate(row.fin), Agente: row.agente || row.guard || row.user || "—", Recorrido: row.recorrido || row.route || "—", Estado: row.estado || (row.cumplida ? "cumplida" : "pendiente") };
    case "supervision":
      return { Fecha: fmtDate(row.fecha || row.createdAt), Supervisor: row.supervisor || row.user || "—", Área: row.area || row.sector || "—", Hallazgos: Array.isArray(row.hallazgos) ? row.hallazgos.length : (row.hallazgos ?? "—"), Estado: row.estado || row.status || "—" };
    case "evaluacion":
      return { Fecha: fmtDate(row.fecha || row.createdAt), Evaluado: row.evaluado || row.colaborador || row.user || "—", Evaluador: row.evaluador || row.supervisor || "—", Puntaje: row.puntaje ?? row.score ?? "—", Estado: row.estado || row.status || "—" };
    case "accesos":
      return { Fecha: fmtDate(row.fecha || row.createdAt), Persona: row.persona || row.nombre || row.user || "—", Documento: row.documento || row.doc || "—", Puerta: row.puerta || row.acceso || row.reader || "—", Resultado: row.resultado || row.estado || row.status || "—" };
    default:
      return row;
  }
}
function computeKpis(module, rowsRaw) {
  const rows = rowsRaw || [];
  const total = rows.length;
  if (module === "incidentes") {
    const abiertos = rows.filter(r => /abierto|open|en_progreso|pendiente/i.test(r.estado || r.status || "")).length;
    const cerrados = rows.filter(r => /cerrado|resuelto|closed/i.test(r.estado || r.status || "")).length;
    const alta     = rows.filter(r => /alta|high/i.test(r.prioridad || r.priority || "")).length;
    return [{ label: "Total", value: total }, { label: "Abiertos", value: abiertos }, { label: "Cerrados", value: cerrados }, { label: "Alta prioridad", value: alta }];
  }
  if (module === "visitas") {
    const enCurso     = rows.filter(r => /en_curso|abierta/i.test(r.estado || r.status || "") || (!!r.horaEntrada && !r.horaSalida)).length;
    const finalizadas = rows.filter(r => /finalizada|cerrada/i.test(r.estado || r.status || "") || (!!r.horaSalida)).length;
    const duraciones  = rows.map(r => {
      const a = r.horaEntrada ? new Date(r.horaEntrada) : null;
      const b = r.horaSalida  ? new Date(r.horaSalida)  : null;
      return a && b ? (b - a) / 60000 : null;
    }).filter(x => x != null);
    const prom = duraciones.length ? Math.round(duraciones.reduce((s,x)=>s+x,0)/duraciones.length) : "—";
    return [{ label: "Total", value: total }, { label: "En curso", value: enCurso }, { label: "Finalizadas", value: finalizadas }, { label: "Permanencia prom. (min)", value: prom }];
  }
  if (module === "rondas") {
    const cumplidas = rows.filter(r => r.cumplida || /cumplida|completada/i.test(r.estado || "")).length;
    const omitidas  = rows.filter(r => /omitida|faltante|incompleta/i.test(r.estado || "")).length;
    const cobertura = total ? Math.round((cumplidas/total)*100)+"%" : "—";
    return [{ label: "Total", value: total }, { label: "Cumplidas", value: cumplidas }, { label: "Omitidas", value: omitidas }, { label: "Cobertura", value: cobertura }];
  }
  if (module === "supervision") {
    const completadas = rows.filter(r => /completada|cerrada|ok/i.test(r.estado || r.status || "")).length;
    const pendientes  = rows.filter(r => /pendiente|abierta/i.test(r.estado || r.status || "")).length;
    const hallazgos   = rows.reduce((acc,r)=> acc + (Array.isArray(r.hallazgos)? r.hallazgos.length : (r.hallazgos?1:0)), 0);
    return [{ label: "Total", value: total }, { label: "Completadas", value: completadas }, { label: "Pendientes", value: pendientes }, { label: "Hallazgos", value: hallazgos }];
  }
  if (module === "evaluacion") {
    const completadas = rows.filter(r => /completada|cerrada|finalizada|ok/i.test(r.estado || r.status || "")).length;
    const pendientes  = rows.filter(r => /pendiente|abierta/i.test(r.estado || r.status || "")).length;
    const puntajes    = rows.map(r => Number(r.puntaje ?? r.score)).filter(n => !Number.isNaN(n));
    const promedio    = puntajes.length ? Math.round((puntajes.reduce((s,n)=>s+n,0)/puntajes.length)*10)/10 : "—";
    return [{ label: "Total", value: total }, { label: "Completadas", value: completadas }, { label: "Pendientes", value: pendientes }, { label: "Puntaje promedio", value: promedio }];
  }
  if (module === "accesos") {
    const aprobados = rows.filter(r => /aprobado|permitido|ok|granted|success/i.test(r.resultado || r.estado || r.status || "")).length;
    const denegados = rows.filter(r => /denegado|rechazado|denied|fail/i.test(r.resultado || r.estado || r.status || "")).length;
    return [{ label: "Total", value: total }, { label: "Aprobados", value: aprobados }, { label: "Denegados", value: denegados }, { label: "Tasa aprobación", value: total ? Math.round((aprobados/total)*100)+"%" : "—" }];
  }
  return [{ label: "Total", value: total }];
}

/* ============================
   DateInput (texto + date oculto)
============================ */
const CalendarIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
function DateInput({ label, value, onChange }) {
  const hiddenRef = React.useRef(null);
  const [text, setText] = React.useState(isoToDisplay(value));
  React.useEffect(() => { setText(isoToDisplay(value)); }, [value]);

  const commit = () => {
    const iso = displayToISO(text);
    if (iso) onChange?.({ target: { value: iso } });
    else setText(isoToDisplay(value));
  };
  const openPicker = () => {
    const el = hiddenRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else { el.focus(); el.click(); }
    } catch {
      const manual = window.prompt("Fecha (dd/mm/aaaa)", text || "");
      const iso = displayToISO(manual || "");
      if (iso) onChange?.({ target: { value: iso } });
    }
  };

  return (
    <div className="w-[190px] shrink-0">
      <label className="block text-xs opacity-70 mb-1">{label}</label>
      <div className="relative inline-flex w-full">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          className="input w-full pr-9 font-[tabular-nums] bg-white/80 dark:bg-neutral-900/80 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          autoComplete="off"
        />
        {/* date oculto para abrir el picker */}
        <input
          ref={hiddenRef}
          type="date"
          value={value || ""}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
          className="absolute opacity-0 pointer-events-none w-0 h-0 -z-10"
          tabIndex={-1}
          aria-hidden
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70"
          onClick={openPicker}
          aria-label="Elegir fecha"
          title="Elegir fecha"
        >
          <CalendarIcon />
        </button>
      </div>
    </div>
  );
}

/* ============================
   Exportadores (idénticos a Evaluación)
============================ */
const EXPORT_STYLES = `
.btn-export{
  --g1:#8b5cf6; --g2:#06b6d4; --g3:#22c55e;
  --bg: rgba(255,255,255,.80); --fg:#0b0f1a;
  position:relative; display:inline-flex; align-items:center; gap:.5rem;
  height:40px; padding:0 .9rem; border-radius:.9rem; border:1px solid transparent;
  color:var(--fg);
  background:
    linear-gradient(var(--bg),var(--bg)) padding-box,
    linear-gradient(135deg,var(--g1),var(--g2),var(--g3)) border-box;
  box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 0 0 3px rgba(6,182,212,.14);
  transition: filter .2s ease, transform .06s ease, box-shadow .2s ease;
}
.dark .btn-export{
  --bg: rgba(10,10,10,.70); --fg:#f8fafc;
  box-shadow: 0 1px 0 rgba(255,255,255,.05), 0 0 0 3px rgba(6,182,212,.12);
}
.btn-export:hover{ filter:saturate(1.15) brightness(1.03); }
.btn-export:active{ transform:translateY(1px); }
.btn-export[data-empty="true"]{ filter:saturate(.92) opacity:.98; }

.btn-export .spark{
  position:absolute; inset:-2px; border-radius:1rem; pointer-events:none;
  background:
    radial-gradient(60px 18px at 14% 18%, rgba(139,92,246,.35), transparent 60%),
    radial-gradient(60px 18px at 86% 82%, rgba(34,197,94,.28), transparent 60%);
  filter: blur(18px) opacity(.7);
}

.menu-surf{ border-radius:.9rem; border:1px solid rgba(120,120,120,.25); background:rgba(255,255,255,.96); }
.dark .menu-surf{ background:rgba(10,10,10,.96); border-color:rgba(120,120,120,.25); }
.menu-item{ width:100%; text-align:left; padding:.55rem .75rem; border-radius:.6rem; }
.menu-item:hover{ background:rgba(0,0,0,.06); }
.dark .menu-item:hover{ background:rgba(255,255,255,.08); }
.menu-item[aria-disabled="true"]{ opacity:.5; cursor:not-allowed; }
`;

function ExportIcon({ size = 18 }) {
  const gid = React.useId();
  const gref = `url(#${gid}-g)`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={gref} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#8b5cf6"/>
          <stop offset="50%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#22c55e"/>
        </linearGradient>
      </defs>
      <path d="M12 3v12"/>
      <path d="M6 9l6 6 6-6"/>
      <rect x="4" y="19" width="16" height="2" rx="1"/>
    </svg>
  );
}

function ExportMenu({ hasRows, onCsv, onXls, onDoc, onPdf }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc   = (e) => { if (e.key === "Escape") setOpen(false); };
    if (open) { document.addEventListener("mousedown", click); document.addEventListener("keydown", esc); }
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-export"
        data-empty={!hasRows}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu" aria-expanded={open}
      >
        <ExportIcon />
        <span>Exportar</span>
        <span className="spark" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 p-1 shadow-xl menu-surf z-50" role="menu">
          <button className="menu-item" aria-disabled={!hasRows}
                  onClick={()=>{ if(hasRows){ onCsv?.(); setOpen(false);} }}>CSV</button>
          <button className="menu-item" aria-disabled={!hasRows}
                  onClick={()=>{ if(hasRows){ onXls?.(); setOpen(false);} }}>Excel</button>
          <button className="menu-item" aria-disabled={!hasRows}
                  onClick={()=>{ if(hasRows){ onDoc?.(); setOpen(false);} }}>Word</button>
          <button className="menu-item" aria-disabled={!hasRows}
                  onClick={()=>{ if(hasRows){ onPdf?.(); setOpen(false);} }}>PDF</button>
        </div>
      )}
    </div>
  );
}

/* ============================
   Reportes
============================ */
export default function Reportes() {
  const today = new Date();
  const fromDefault = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const toDefault   = toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [filters, setFilters] = React.useState({ module: "incidentes", sede: "", from: fromDefault, to: toDefault });
  const [sedes, setSedes]     = React.useState(SEDES_FALLBACK);
  const [rows, setRows]       = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/sedes");
        if (alive && Array.isArray(data) && data.length) setSedes(["", ...data.map(s => (s.nombre || s.name || s))]);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const { module, from, to, sede } = filters;
      let data = null;
      try {
        const r = await api.get("/reportes", { params: { modulo: module, from, to, sede } });
        data = r?.data?.items ?? r?.data ?? null;
      } catch { data = null; }
      if (!Array.isArray(data)) {
        const r = await api.get(`/${module}`, { params: { from, to, sede } });
        data = r?.data?.items ?? r?.data ?? [];
      }
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [filters]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const tableRows = React.useMemo(() => rows.map(r => projectRow(filters.module, r)), [rows, filters.module]);
  const cols      = React.useMemo(() => (tableRows[0] ? Object.keys(tableRows[0]) : []), [tableRows]);
  const kpis      = React.useMemo(() => computeKpis(filters.module, rows), [filters.module, rows]);

  const setRange = (from, to) => setFilters(f => ({ ...f, from, to }));
  const onPreset = (type) => {
    const now = new Date();
    if (type === "hoy")  return setRange(toISODate(now), toISODate(now));
    if (type === "7d")   return setRange(toISODate(new Date(now - 6 * 864e5)), toISODate(now));
    if (type === "30d")  return setRange(toISODate(new Date(now - 29 * 864e5)), toISODate(now));
    if (type === "mes")  return setRange(
      toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    );
  };

  const title   = `Reporte ${MODULOS.find(m => m.value === filters.module)?.label || ""} (${filters.from} a ${filters.to})`;
  const hasRows = tableRows.length > 0;

  return (
    <section className="space-y-6">
      <style>{EXPORT_STYLES}</style>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {/* Campos */}
          <div className="flex flex-wrap items-end gap-3 grow">
            <div className="w-[240px] shrink-0">
              <label className="block text-xs opacity-70 mb-1">Módulo</label>
              <select
                className="input bg-white/80 dark:bg-neutral-900/80 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                value={filters.module}
                onChange={(e) => setFilters(f => ({ ...f, module: e.target.value }))}
              >
                {MODULOS.map(m => (
                  <option key={m.value} value={m.value} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-[240px] shrink-0">
              <label className="block text-xs opacity-70 mb-1">Sede</label>
              <select
                className="input bg-white/80 dark:bg-neutral-900/80 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                value={filters.sede}
                onChange={(e) => setFilters(f => ({ ...f, sede: e.target.value }))}
              >
                {sedes.map(s => (
                  <option key={s || "todas"} value={s} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
                    {s || "Todas"}
                  </option>
                ))}
              </select>
            </div>

            <DateInput
              label="Desde"
              value={filters.from}
              onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
            />
            <DateInput
              label="Hasta"
              value={filters.to}
              onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
            />
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onPreset("hoy")}  className="px-3 py-1.5 rounded-lg border border-neutral-300/60 dark:border-neutral-700/60">Hoy</button>
            <button onClick={() => onPreset("7d")}   className="px-3 py-1.5 rounded-lg border border-neutral-300/60 dark:border-neutral-700/60">7 días</button>
            <button onClick={() => onPreset("30d")}  className="px-3 py-1.5 rounded-lg border border-neutral-300/60 dark:border-neutral-700/60">30 días</button>
            <button onClick={() => onPreset("mes")}  className="px-3 py-1.5 rounded-lg border border-neutral-300/60 dark:border-neutral-700/60">Mes</button>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Aplicar</button>
            <ExportMenu
              hasRows={hasRows}
              onCsv={() => exportCSV(`reporte_${filters.module}_${filters.from}_${filters.to}`, tableRows)}
              onXls={() => exportExcel(`reporte_${filters.module}_${filters.from}_${filters.to}`, title, cols, tableRows)}
              onDoc={() => exportWord(`reporte_${filters.module}_${filters.from}_${filters.to}`, title, cols, tableRows)}
              onPdf={() => exportPdf(title, cols, tableRows)}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4 bg-white/60 dark:bg-neutral-950/60 backdrop-blur">
            <div className="text-xs opacity-70">{k.label}</div>
            <div className="text-2xl font-semibold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">
            {MODULOS.find(m => m.value === filters.module)?.label} — resultados
          </h2>
        {loading && <div className="text-sm opacity-70">Cargando…</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                {cols.map(c => <th key={c} className="py-2 pr-4">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {!hasRows && !loading && (
                <tr><td colSpan={cols.length || 1} className="py-6 opacity-70">Sin datos para los filtros seleccionados.</td></tr>
              )}
              {tableRows.map((r, i) => (
                <tr key={i} className="border-b border-neutral-800/20">
                  {cols.map(c => <td key={c} className="py-2 pr-4">{r[c] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
