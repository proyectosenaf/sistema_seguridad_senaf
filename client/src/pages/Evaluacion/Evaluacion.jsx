import React from "react";
import { api } from "../../lib/api.js";

/* =========================
   Utils
========================= */
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
};
const toYYYYMM = (d) => new Date(d).toISOString().slice(0, 7);

/* =========================
   Export helpers
========================= */
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
  const a = document.createElement("a"); a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportExcel(filename, title, cols, rows) {
  if (!rows.length) return;
  const html = `<!DOCTYPE html><meta charset="UTF-8">${tableHTML(title, cols, rows)}`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click(); URL.revokeObjectURL(url);
}

function exportWord(filename, title, cols, rows) {
  if (!rows.length) return;
  const html = `<!DOCTYPE html><meta charset="UTF-8"><title>${title}</title>${tableHTML(title, cols, rows)}`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = filename.endsWith(".doc") ? filename : `${filename}.doc`;
  a.click(); URL.revokeObjectURL(url);
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

/* =========================
   Icono y MonthInput sin solapes
========================= */
function CalendarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}
function MonthInput({ label, value, onChange }) {
  const ref = React.useRef(null);
  return (
    <div className="min-w-[220px]">
      <label className="block text-sm opacity-70 mb-1">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          type="month"
          value={value}
          onChange={onChange}
          className="input month-input bg-white/80 dark:bg-neutral-900/80 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700 pr-12"
        />
        <div className="absolute right-0 top-0 bottom-0 w-10 rounded-r-[0.75rem] bg-white/80 dark:bg-neutral-900/80 pointer-events-none" aria-hidden />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 z-10"
          onClick={() => (ref.current?.showPicker ? ref.current.showPicker() : ref.current?.focus())}
          aria-label="Abrir selector de mes"
        >
          <CalendarIcon />
        </button>
      </div>
    </div>
  );
}

/* =========================
   Botón Exportar hermoso (degradado + glass)
========================= */
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

/* === Menú Exportar: SIEMPRE abre; ítems se deshabilitan si no hay filas === */
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

/* =========================
   Evaluación
========================= */
export default function Evaluacion() {
  // FIX global para <input type="month">
  const MONTH_FIX = `
    .month-input{
      padding-right: 2.75rem;
      appearance:none; -webkit-appearance:none; -moz-appearance:none;
      background-image:none!important;
    }
    .month-input::-webkit-calendar-picker-indicator{ display:none; opacity:0; }
    .month-input::-webkit-inner-spin-button{ display:none; }
    .month-input::-ms-clear{ display:none; }
  `;

  const [filters, setFilters] = React.useState({
    periodo: toYYYYMM(new Date()),
    q: ""
  });

  const [rows, setRows]       = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const { periodo, q } = filters;
      let data = null;
      try {
        const r = await api.get("/evaluaciones", { params: { periodo, q } });
        data = r?.data?.items ?? r?.data ?? null;
      } catch { data = null; }
      if (!Array.isArray(data)) {
        const r = await api.get("/evaluacion", { params: { periodo, q } });
        data = r?.data?.items ?? r?.data ?? [];
      }
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const tableRows = React.useMemo(() => rows.map(r => ({
    Empleado: r.empleado?.nombre ?? r.empleado ?? r.nombre ?? "—",
    Periodo:  r.periodo ?? (r.fecha ? toYYYYMM(r.fecha) : filters.periodo),
    Puntaje:  r.puntaje ?? r.score ?? "—",
    Observaciones: r.observaciones ?? r.obs ?? "",
    Fuente:   r.fuente ?? r.source ?? "—",
    Actualizado: fmtDate(r.updatedAt ?? r.actualizado ?? r.fechaActualizacion ?? r.fecha)
  })), [rows, filters.periodo]);

  const cols   = React.useMemo(() => (tableRows[0] ? Object.keys(tableRows[0]) : []), [tableRows]);
  const total  = rows.length;
  const promedio = React.useMemo(() => {
    const nums = rows.map(r => Number(r.puntaje ?? r.score)).filter(n => !Number.isNaN(n));
    return nums.length ? Math.round((nums.reduce((s,n)=>s+n,0)/nums.length)*10)/10 : 0;
  }, [rows]);

  const fnameBase = `evaluacion_${filters.periodo}`;
  const hasRows   = tableRows.length > 0;

  const sync = async () => {
    try {
      await api.post("/evaluacion/sync", { periodo: filters.periodo });
      fetchData();
    } catch {}
  };

  return (
    <section className="space-y-6">
      <style>{MONTH_FIX + EXPORT_STYLES}</style>

      {/* Toolbar */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-3">
          <MonthInput
            label="Periodo"
            value={filters.periodo}
            onChange={(e)=>setFilters(f => ({ ...f, periodo: e.target.value }))}
          />

          <div className="flex-1 min-w-[280px]">
            <label className="block text-sm opacity-70 mb-1">Buscar</label>
            <input
              className="input"
              placeholder="Buscar por empleado..."
              value={filters.q}
              onChange={(e)=>setFilters(f => ({ ...f, q: e.target.value }))}
            />
          </div>

          <div className="min-w-[220px]">
            <label className="block text-sm opacity-70 mb-1">&nbsp;</label>
            <button onClick={fetchData} className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700">
              Aplicar filtros
            </button>
          </div>

          {/* Exportadores (menú SIEMPRE abre) */}
          <div className="ml-auto">
            <label className="block text-sm opacity-70 mb-1">&nbsp;</label>
            <ExportMenu
              hasRows={hasRows}
              onCsv={() => exportCSV(`${fnameBase}.csv`, tableRows)}
              onXls={() => exportExcel(`${fnameBase}.xls`, `Evaluación ${filters.periodo}`, cols, tableRows)}
              onDoc={() => exportWord(`${fnameBase}.doc`, `Evaluación ${filters.periodo}`, cols, tableRows)}
              onPdf={() => exportPdf(`Evaluación ${filters.periodo}`, cols, tableRows)}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-sm opacity-70">Periodo</div>
            <div className="text-2xl font-semibold">{filters.periodo}</div>
          </div>
          <div>
            <div className="text-sm opacity-70">Total</div>
            <div className="text-2xl font-semibold">{total}</div>
          </div>
          <div>
            <div className="text-sm opacity-70">Promedio</div>
            <div className="text-2xl font-semibold">{promedio}</div>
          </div>

          <div className="ml-auto">
            <button onClick={sync} className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700">
              Sincronizar desde supervisión
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Resultados</h2>
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
                <tr><td colSpan={cols.length || 1} className="py-8 text-center opacity-70">Sin registros.</td></tr>
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
// Página Evaluación: filtros, KPIs y tabla de datos con exportación