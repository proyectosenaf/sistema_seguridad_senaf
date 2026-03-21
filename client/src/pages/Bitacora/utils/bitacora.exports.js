import { COMPANY } from "../constants";
import { fmtDate } from "./bitacora.formatters";

export function buildExcelHTML({ rows, stats, title = "Bitácora — Exporte" }) {
  const css = `
  *{ box-sizing:border-box; font-family: Calibri, Arial, sans-serif; }
  body{ color:#0b132b; padding:16px; }
  header{ display:flex; justify-content:space-between; align-items:flex-start; }
  .company{ font-size:22px; font-weight:800; letter-spacing:.5px; margin-bottom:4px; }
  .meta{ text-align:right; font-size:12px; color:#334155; line-height:1.25; }
  .title{ font-size:28px; font-weight:800; margin:10px 0 8px; }
  .chips{ display:flex; gap:10px; margin: 4px 0 14px; flex-wrap: wrap; }
  .chip{ font-weight:700; font-size:13px; padding:6px 10px; border-radius:999px; background:#eef2ff; color:#1e3a8a; border:1px solid #dbeafe; }
  table{ border-collapse:separate; border-spacing:0; width:100%; }
  td{ padding:8px 12px; font-size:13px; border-bottom:1px solid #e5e7eb; }
  tr:nth-child(even) td{ background:#f8fafc; }
  td.desc{ white-space: pre-wrap; line-height:1.3; }
  `;
  const headerStyle = [
    "background:#1d4ed8",
    "color:#ffffff",
    "font-weight:bold",
    "padding:10px 12px",
    "border-right:1px solid rgba(255,255,255,.35)",
    "mso-number-format:'@'",
  ].join(";");

  const now = new Date();

  return `
  <!doctype html><html><head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>${css}</style>
  </head><body>
    <header>
      <div class="company">${COMPANY}</div>
      <div class="meta">
        <div><strong>Fecha:</strong> ${now.toLocaleDateString()} — <strong>Hora:</strong> ${now.toLocaleTimeString()}</div>
        <div><strong>Periodo:</strong> Filtrado actual</div>
      </div>
    </header>

    <div class="title">${title}</div>
    <div class="chips">
      <span class="chip">Registros: ${stats.registros}</span>
      <span class="chip">Incidentes: ${stats.incidentes}</span>
      <span class="chip">Rondas: ${stats.rondas}</span>
      <span class="chip">Visitas: ${stats.visitas}</span>
      <span class="chip">Accesos: ${stats.accesos}</span>
    </div>

    <table>
      <tr>
        <td style="${headerStyle}">Empleado / Agente</td>
        <td style="${headerStyle}">Fecha</td>
        <td style="${headerStyle}">Turno</td>
        <td style="${headerStyle}">Tipo</td>
        <td style="${headerStyle}">Módulo</td>
        <td style="${headerStyle}">Prioridad</td>
        <td style="${headerStyle}">Estado</td>
        <td style="${headerStyle}; border-right:none;">Descripción</td>
      </tr>
      ${rows
        .map(
          (r) => `
        <tr>
          <td>${escapeHtml(r.agente || r.nombre || "")}</td>
          <td>${escapeHtml(fmtDate(r.fecha))}</td>
          <td>${escapeHtml(r.turno || "")}</td>
          <td>${escapeHtml(r.tipo || "")}</td>
          <td>${escapeHtml(r.modulo || "")}</td>
          <td>${escapeHtml(r.prioridad || "")}</td>
          <td>${escapeHtml(r.estado || "")}</td>
          <td class="desc">${escapeHtml(r.descripcion || "")}</td>
        </tr>`
        )
        .join("")}
    </table>
  </body></html>`;
}

export function buildPDFHTML({ rows, stats }) {
  const css = `
  @page{ margin:22mm 16mm; }
  :root{ --ink:#0b132b; --muted:#64748b; --blue:#1d4ed8; }
  *{ box-sizing:border-box; font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial; }
  body{ color:var(--ink); }
  header{ display:flex; justify-content:space-between; align-items:flex-start; font-size:12px; color:var(--muted); margin-bottom:8px; }
  h1{ font-size:34px; margin:4px 0 8px; font-weight:800; letter-spacing:.3px; }
  .pills{ margin:8px 0 14px; display:flex; gap:8px; flex-wrap:wrap; }
  .pill{ display:inline-block; padding:6px 10px; border-radius:999px; background:#eef2ff; color:#1e3a8a; font-weight:700; font-size:12px; border:1px solid #dbeafe; }
  table{ width:100%; border-collapse:separate; border-spacing:0; }
  thead th{
    background: var(--blue);
    color:#ffffff;
    font-size:12.5px;
    padding:10px 8px;
    text-align:left;
    font-weight:800;
    border-right:1px solid rgba(255,255,255,.35);
  }
  thead th:last-child{ border-right:none; }
  tbody td{ font-size:12.5px; padding:12px 8px; vertical-align:top; border-bottom:1px solid #e5e7eb; }
  td.desc{ white-space: pre-wrap; line-height:1.45; }
  footer{ position: fixed; bottom: 10mm; left:0; right:0; text-align:center; font-size:12px; color:#93a3c6; }
  `;
  const now = new Date();

  return `
  <!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <header>
      <div class="company">${COMPANY}</div>
      <div><strong>Fecha:</strong> ${now.toLocaleDateString()} — <strong>Hora:</strong> ${now.toLocaleTimeString()} <strong style="margin-left:10px">Periodo:</strong> Filtrado actual</div>
    </header>

    <h1>Bitácora — Reporte</h1>
    <div class="pills">
      <span class="pill">Registros: ${stats.registros}</span>
      <span class="pill">Incidentes: ${stats.incidentes}</span>
      <span class="pill">Rondas: ${stats.rondas}</span>
      <span class="pill">Visitas: ${stats.visitas}</span>
      <span class="pill">Accesos: ${stats.accesos}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Empleado / Agente</th>
          <th>Fecha</th>
          <th>Turno</th>
          <th>Tipo</th>
          <th>Módulo</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(r.agente || r.nombre || "")}</td>
            <td>${escapeHtml(fmtDate(r.fecha))}</td>
            <td>${escapeHtml(r.turno || "")}</td>
            <td>${escapeHtml(r.tipo || "")}</td>
            <td>${escapeHtml(r.modulo || "")}</td>
            <td>${escapeHtml(r.prioridad || "")}</td>
            <td>${escapeHtml(r.estado || "")}</td>
            <td class="desc">${escapeHtml(r.descripcion || "")}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <footer>(Generado por el sistema de bitácora SENAF)</footer>
  </body></html>`;
}

export function downloadExcel(rows, stats) {
  const html = buildExcelHTML({
    rows,
    stats,
    title: "Bitácora — Exporte Filtrado",
  });
  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bitacora_filtrado_${Date.now()}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printPDF(rows, stats) {
  const html = buildPDFHTML({ rows, stats });
  const w = window.open("", "_blank");
  if (!w) {
    alert("Permite la ventana emergente para descargar el PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}