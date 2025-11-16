// src/modules/rondasqr/supervisor/ReportsPage.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi";
import ReportSummary from "./ReportSummary";
import OmissionsTable from "./OmissionsTable";
import MessagesTable from "./MessagesTable";
import MapView from "./MapView";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  // NUEVO: catálogo de oficiales (guardias) y texto en el input buscable
  const [officers, setOfficers] = useState([]);
  const [officerQuery, setOfficerQuery] = useState("");

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

  // NUEVO: cargar guardias (rol Guardia)
  useEffect(() => {
    (async () => {
      try {
        // Ajusta esta llamada al endpoint real que tengas para listar guardias
        const resp = await rondasqrApi.listOfficers();
        const items = resp?.items || resp || [];

        const normalized = items.map((u) => {
          const name =
            u.name ||
            `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
            u.fullName ||
            u.email ||
            u.username ||
            "Sin nombre";

          return {
            id: u._id || u.id || u.guardId || u.userId,
            name,
            email: u.email || u.username || "",
            guardId: u.guardId || u.employeeId || u._id || u.id,
          };
        });

        setOfficers(normalized);
      } catch (e) {
        console.warn("[ReportsPage] listOfficers error:", e);
      }
    })();
  }, []);

  function getOfficerLabel(o) {
    if (!o) return "";
    if (o.email) return `${o.name} (${o.email})`;
    return o.name;
  }

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
    setOfficerQuery("");
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

  /* ---------- Exportar helper: encabezados y dataset ---------- */

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

  /* ===================== PDF helpers (descargar / imprimir) ===================== */
  function finalizePdf(doc, filename, mode) {
    if (mode === "print") {
      doc.autoPrint();
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    } else {
      doc.save(filename);
    }
  }

  /* ===================== PDF: OMISIONES ===================== */
  function exportOmissionsPdf(mode = "download") {
    const rows = omissionsToExport || [];
    if (!rows.length) {
      alert("No hay omisiones para exportar con los filtros actuales.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const fechaHora = new Date();

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SEGURIDAD SENAF", 14, 14);

    doc.setFontSize(16);
    doc.text("Informe de Omisiones de Rondas", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Rondas omitidas dentro del rango seleccionado", 14, 28);

    // Meta
    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${f.officer || "Todos"}`,
      `Generado: ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}`,
      `Total omisiones: ${rows.length}`,
    ];

    let y = 34;
    doc.setFontSize(9);
    metaLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 4;
    });

    const tableBody = rows.map((o, i) => {
      const fecha = formatDateTime(o.expectedAt || o.expectedTime || o.date || o.ts);
      const ronda = o.roundName || o.roundId || "—";
      const punto = o.pointName || o.point || o.pointId || "—";
      const oficial = o.officerName || o.officerEmail || o.guardId || "—";

      return [i + 1, ronda, fecha, punto, oficial, "Omitido"];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [["#", "Ronda", "Fecha/Hora esperada", "Punto", "Oficial", "Estado"]],
      body: tableBody,
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        const pageHeight =
          doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth =
          doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          "Generado por el módulo de Rondas QR — Seguridad SENAF",
          data.settings.margin.left,
          pageHeight - 8
        );
        const pageNumber = doc.internal.getNumberOfPages();
        doc.text(String(pageNumber), pageWidth - 10, pageHeight - 8);
      },
    });

    const filename = `omisiones-${f.from || "desde"}_${f.to || "hasta"}.pdf`;
    finalizePdf(doc, filename, mode);
  }

  /* ==================== PDF: RONDAS ==================== */
  function exportRoundsPdf(mode = "download") {
    const rows = data.stats || [];
    if (!rows.length) {
      alert("No hay datos de rondas para exportar con los filtros actuales.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const fechaHora = new Date();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SEGURIDAD SENAF", 14, 14);

    doc.setFontSize(16);
    doc.text("Informe de Rondas", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Resumen de rondas ejecutadas dentro del rango seleccionado", 14, 28);

    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${f.officer || "Todos"}`,
      `Generado: ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}`,
      `Total filas: ${rows.length}`,
    ];

    let y = 34;
    doc.setFontSize(9);
    metaLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 4;
    });

    const tableBody = rows.map((r, i) => {
      const guard =
        r.guardName || r.officerName || r.officerEmail || r.guardId || "—";
      const site = r.siteName || r.site || "—";
      const round = r.roundName || r.round || r.roundId || "—";

      const programadas = r.totalRounds ?? r.programadas ?? r.total ?? 0;
      const realizadas = r.completed ?? r.realizadas ?? r.done ?? 0;
      const omitidas = r.missed ?? r.omitidas ?? r.omissions ?? 0;

      const cumplimientoRaw =
        r.compliancePct ??
        r.compliance ??
        r.pct ??
        (programadas ? Math.round((realizadas / programadas) * 100) : 0);

      const cumplimiento = Number.isFinite(cumplimientoRaw)
        ? `${Math.round(cumplimientoRaw)}%`
        : "—";

      return [
        i + 1,
        guard,
        site,
        round,
        programadas,
        realizadas,
        omitidas,
        cumplimiento,
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [
        [
          "#",
          "Oficial",
          "Sitio",
          "Ronda",
          "Programadas",
          "Realizadas",
          "Omitidas",
          "Cumplimiento",
        ],
      ],
      body: tableBody,
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        const pageHeight =
          doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth =
          doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          "Generado por el módulo de Rondas QR — Seguridad SENAF",
          data.settings.margin.left,
          pageHeight - 8
        );
        const pageNumber = doc.internal.getNumberOfPages();
        doc.text(String(pageNumber), pageWidth - 10, pageHeight - 8);
      },
    });

    const filename = `rondas-${f.from || "desde"}_${f.to || "hasta"}.pdf`;
    finalizePdf(doc, filename, mode);
  }

  /* ==================== PDF: ALERTAS DE PÁNICO (antes Mensajes / Incidentes) ==================== */
  function exportMessagesPdf(mode = "download") {
    const rows = data.messages || [];
    if (!rows.length) {
      alert("No hay alertas de pánico para exportar con los filtros actuales.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const fechaHora = new Date();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SEGURIDAD SENAF", 14, 14);

    doc.setFontSize(16);
    doc.text("Informe de Alertas de pánico", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      "Alertas de pánico generadas dentro del rango seleccionado",
      14,
      28
    );

    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${f.officer || "Todos"}`,
      `Generado: ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}`,
      `Total alertas de pánico: ${rows.length}`,
    ];

    let y = 34;
    doc.setFontSize(9);
    metaLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 4;
    });

    const tableBody = rows.map((m, i) => {
      const tipo = m.type || m.kind || m.level || "—";
      const fecha = formatDateTime(m.ts || m.date || m.createdAt);
      const sitio = m.siteName || m.site || "—";
      const ronda = m.roundName || m.round || "—";
      const oficial = m.officerName || m.officerEmail || m.guardId || "—";
      const detalle = m.message || m.description || m.detail || "—";
      const gps = m.gps || m.coordinates || m.location || "—";

      return [i + 1, tipo, fecha, sitio, ronda, oficial, detalle, gps];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [
        [
          "#",
          "Tipo",
          "Fecha / Hora",
          "Sitio",
          "Ronda",
          "Oficial",
          "Detalle",
          "GPS",
        ],
      ],
      body: tableBody,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 18 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 26 },
        6: { cellWidth: 45 },
        7: { cellWidth: 25 },
      },
      didDrawPage: (data) => {
        const pageHeight =
          doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth =
          doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          "Generado por el módulo de Rondas QR — Seguridad SENAF",
          data.settings.margin.left,
          pageHeight - 8
        );
        const pageNumber = doc.internal.getNumberOfPages();
        doc.text(String(pageNumber), pageWidth - 10, pageHeight - 8);
      },
    });

    const filename = `alertas-panico-${f.from || "desde"}_${f.to || "hasta"}.pdf`;
    finalizePdf(doc, filename, mode);
  }

  /* ==================== PDF: DETALLE DE MARCAS ==================== */
  function exportDetailPdf(mode = "download") {
    const rows = data.detailed || [];
    if (!rows.length) {
      alert("No hay detalle de marcas para exportar con los filtros actuales.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape", // más ancho → más columnas cómodas
      unit: "mm",
      format: "a4",
    });

    const fechaHora = new Date();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SEGURIDAD SENAF", 14, 14);

    doc.setFontSize(16);
    doc.text("Detalle de Rondas y Marcas", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      "Marcas realizadas por los guardias dentro del rango seleccionado",
      14,
      28
    );

    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${f.officer || "Todos"}`,
      `Generado: ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}`,
      `Total registros: ${rows.length}`,
    ];

    let y = 34;
    doc.setFontSize(9);
    metaLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 4;
    });

    const tableBody = rows.map((r, i) => {
      const fecha = formatDateTime(r.ts || r.date || r.createdAt);
      const sitio = r.siteName || r.site || "—";
      const ronda = r.roundName || r.round || "—";
      const punto = r.pointName || r.point || r.pointId || "—";
      const oficial = r.officerName || r.officerEmail || r.guardId || "—";
      const enVentana =
        typeof r.inWindow === "boolean" ? (r.inWindow ? "Sí" : "No") : "—";
      const estado = r.status || r.state || r.result || "—";

      return [i + 1, fecha, sitio, ronda, punto, oficial, enVentana, estado];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [
        [
          "#",
          "Fecha / Hora",
          "Sitio",
          "Ronda",
          "Punto",
          "Oficial",
          "En ventana",
          "Estado",
        ],
      ],
      body: tableBody,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        const pageHeight =
          doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth =
          doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          "Generado por el módulo de Rondas QR — Seguridad SENAF",
          data.settings.margin.left,
          pageHeight - 8
        );
        const pageNumber = doc.internal.getNumberOfPages();
        doc.text(String(pageNumber), pageWidth - 10, pageHeight - 8);
      },
    });

    const filename = `detalle-${f.from || "desde"}_${f.to || "hasta"}.pdf`;
    finalizePdf(doc, filename, mode);
  }

  /* ================= EXCEL: OMISIONES ================= */
  function exportOmissionsExcel() {
    const rows = omissionsToExport;
    const fechaHora = new Date();

    const style = `
      <style>
        html, body {
          font-family: Calibri, "Segoe UI", Arial, sans-serif;
          font-size: 12pt;
        }
        .brand {
          font-size:20pt;
          font-weight:800;
          margin:4px 0 2px 0;
          text-transform:uppercase;
          letter-spacing:.12em;
        }
        .subtitle {
          font-size:14pt;
          font-weight:700;
          margin:0 0 6px 0;
        }
        .meta {
          margin:4px 0 8px 0;
          font-size:11pt;
        }
        table {
          width:100%;
          border-collapse:collapse;
          font-size:10pt;
        }
        thead th{
          background:#0f172a; color:#fff; text-align:left; padding:6px;
          border:1px solid #0f172a; font-weight:700;
        }
        tbody td{ padding:5px; border:1px solid #e5e7eb; }
        tbody tr:nth-child(even){ background:#f9fafb; }
      </style>
    `;

    // Zoom 120% para que no se vea "mini" en Excel
    const excelXml = `
      <!--[if gte mso 9]><xml>
      <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
        <ExcelWorksheets>
          <ExcelWorksheet>
            <Name>Omisiones</Name>
            <WorksheetOptions>
              <Selected/>
              <ProtectObjects>False</ProtectObjects>
              <ProtectScenarios>False</ProtectScenarios>
              <Zoom>120</Zoom>
            </WorksheetOptions>
          </ExcelWorksheet>
        </ExcelWorksheets>
      </ExcelWorkbook>
      </xml><![endif]-->
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
        const fecha = formatDateTime(o.expectedAt || o.expectedTime || o.date || o.ts);
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
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8"/>
          ${style}
          ${excelXml}
        </head>
        <body>
          <div class="brand">SEGURIDAD SENAF</div>
          <div class="subtitle">Informe de Omisiones de Rondas</div>
          ${resumenHtml}
          ${table}
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omisiones-${f.from || "desde"}_${f.to || "hasta"}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Exportar (backend + overrides) ---------- */
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
      if (!ok)
        alert("HTTP 404 - No se encontró endpoint de Excel. Verifica la ruta en el servidor.");
    } finally {
      setDownloading(false);
    }
  }

  async function doPdf() {
    // Para tipos específicos generamos el PDF en el front (descargable)
    try {
      setDownloading(true);

      if (f.reportType === "omissions") {
        exportOmissionsPdf("download");
        return;
      }
      if (f.reportType === "rounds") {
        exportRoundsPdf("download");
        return;
      }
      if (f.reportType === "messages") {
        exportMessagesPdf("download");
        return;
      }
      if (f.reportType === "detail") {
        exportDetailPdf("download");
        return;
      }

      // Para "all" o "map" seguimos intentando el endpoint del backend
      const qs = new URLSearchParams(f).toString();
      const candidates = [
        rondasqrApi.pdfUrl(f),
        `${ROOT}/api/rondasqr/v1/reports/pdf?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/export/report.pdf?${qs}`,
      ];
      const ok = await openFirstOk(candidates);
      if (!ok)
        alert("HTTP 404 - No se encontró endpoint de PDF. Verifica la ruta en el servidor.");
    } finally {
      setDownloading(false);
    }
  }

  function doPrint() {
    // Imprimir usando el MISMO formato del PDF (abre el PDF en modo impresión)
    if (f.reportType === "omissions") {
      exportOmissionsPdf("print");
      return;
    }
    if (f.reportType === "rounds") {
      exportRoundsPdf("print");
      return;
    }
    if (f.reportType === "messages") {
      exportMessagesPdf("print");
      return;
    }
    if (f.reportType === "detail") {
      exportDetailPdf("print");
      return;
    }

    // Para "all" o "map" intentamos el backend (PDF ya maquetado del servidor)
    const qs = new URLSearchParams(f).toString();
    const url =
      rondasqrApi.pdfUrl?.(f) ||
      `${ROOT}/api/rondasqr/v1/reports/pdf?${qs}`;
    window.open(url, "_blank");
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

  // ====== lógica para combo buscable de oficiales ======
  const filteredOfficers =
    officerQuery.trim().length === 0
      ? officers
      : officers.filter((o) =>
          getOfficerLabel(o).toLowerCase().includes(officerQuery.toLowerCase())
        );

  function handleOfficerInputChange(e) {
    const value = e.target.value;
    setOfficerQuery(value);
    setF((prev) => ({ ...prev, officer: value }));
  }

  function handleOfficerSelect(officer) {
    const label = getOfficerLabel(officer);
    setOfficerQuery(label);
    setF((prev) => ({
      ...prev,
      officer: officer.guardId || officer.email || officer.id || label,
    }));
  }

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
                { id: "messages", label: "Alertas de pánico" },
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

          {/* Oficial buscable */}
          <div className="flex flex-col relative">
            <label className="text-[11px] text-white/70 mb-1">Oficial (opcional)</label>
            <input
              placeholder="correo / nombre / guardId"
              value={officerQuery}
              onChange={handleOfficerInputChange}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            />
            {filteredOfficers.length > 0 && officerQuery !== "" && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-lg border border-white/15 bg-slate-900/95 backdrop-blur shadow-lg">
                {filteredOfficers.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleOfficerSelect(o);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700/80"
                  >
                    <div className="font-medium">{o.name}</div>
                    {(o.email || o.guardId) && (
                      <div className="text-[10px] text-slate-300">
                        {o.email} {o.guardId && `· ${o.guardId}`}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
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
            Alertas de pánico
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
      {f.includeDetail && <MapView items={data.detailed} /> && <></>}

      {f.includeMap && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-3 shadow-lg">
          <h3 className="font-semibold text-base mb-2">Mapa</h3>
          <MapView items={data.detailed} />
        </div>
      )}
    </div>
  );
}
