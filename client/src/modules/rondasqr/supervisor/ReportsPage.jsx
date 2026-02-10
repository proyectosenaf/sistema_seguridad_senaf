// client/src/modules/rondasqr/supervisor/ReportsPage.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi";
import ReportSummary from "./ReportSummary";
import OmissionsTable from "./OmissionsTable";
import MessagesTable from "./MessagesTable";
import DetailedMarks from "./DetailedMarks";
import MapView from "./MapView";

import iamApi from "../../../iam/api/iamApi.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(
  /\/$/,
  ""
);

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
    officer: "", // aquí guardamos el opId del guardia
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

  // Guardias (igual que en AssignmentsPage)
  const [guards, setGuards] = useState([]); // [{_id, name, email, opId, active}]

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

  /* ─────────────── Cargar guardias (IAM) ─────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let items = [];
        if (typeof iamApi.listGuards === "function") {
          const r = await iamApi.listGuards("", true);
          items = r.items || [];
        } else {
          // fallback si no hay listGuards()
          const r = await iamApi.listUsers("");
          const NS = "https://senaf.local/roles";
          items = (r.items || [])
            .filter((u) => {
              const roles = [
                ...(Array.isArray(u.roles) ? u.roles : []),
                ...(Array.isArray(u[NS]) ? u[NS] : []),
              ].map((x) => String(x).toLowerCase());
              return (
                roles.includes("guardia") ||
                roles.includes("guard") ||
                roles.includes("rondasqr.guard")
              );
            })
            .map((u) => ({
              _id: u._id,
              name: u.name,
              email: u.email,
              opId: u.opId || u.sub || u.legacyId || String(u._id),
              active: u.active !== false,
            }));
        }
        const normalized = (items || []).map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          opId: u.opId || u.sub || u.legacyId || String(u._id),
          active: u.active !== false,
        }));
        if (mounted) setGuards(normalized);
      } catch (e) {
        console.error("[ReportsPage] listGuards error:", e);
        if (mounted) setGuards([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ───────── helpers de guardias ───────── */

  function getGuardLabel(g) {
    if (!g) return "";
    return g.email
      ? `${g.name || "(Sin nombre)"} — ${g.email}`
      : g.name || "(Sin nombre)";
  }

  function findGuardForRecord(rec) {
    if (!rec) return null;

    const possibleIds = [
      rec.guardId,
      rec.officerId,
      rec.officer,
      rec.userId,
      rec.opId,
    ]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());

    const possibleEmails = [rec.officerEmail, rec.email]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());

    return (
      guards.find((g) => {
        const opId = String(g.opId || "").toLowerCase();
        const id = String(g._id || "").toLowerCase();
        const email = String(g.email || "").toLowerCase();
        return (
          possibleIds.includes(opId) ||
          possibleIds.includes(id) ||
          possibleEmails.includes(email)
        );
      }) || null
    );
  }

  function resolveOfficerLabel(rec) {
    const g = findGuardForRecord(rec);
    if (g) return getGuardLabel(g);

    // fallback a lo que venga en el registro
    return (
      rec.officerName ||
      rec.officerEmail ||
      rec.guardId ||
      rec.officerId ||
      rec.officer ||
      rec.userId ||
      "—"
    );
  }

  /* ─────────────── Cargar datos de reporte ─────────────── */
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

  /* ---------- Encabezados comunes ---------- */

  const siteLabel =
    f.siteId && sites.length
      ? sites.find((s) => String(s._id) === String(f.siteId))?.name ||
        "Sitio seleccionado"
      : "Todos";

  const roundLabel =
    f.roundId && rounds.length
      ? rounds.find((r) => String(r._id) === String(f.roundId))?.name ||
        "Ronda seleccionada"
      : "Todas";

  const selectedGuard = guards.find((g) => g.opId === f.officer);
  const officerFilterLabel = selectedGuard
    ? getGuardLabel(selectedGuard)
    : f.officer || "Todos";

  const omissionsToExport = data.omissions || [];

  /* ===================== PDF helpers ===================== */
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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SEGURIDAD SENAF", 14, 14);

    doc.setFontSize(16);
    doc.text("Informe de Omisiones de Rondas", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Rondas omitidas dentro del rango seleccionado", 14, 28);

    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${officerFilterLabel}`,
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
      const fecha = formatDateTime(
        o.expectedAt || o.expectedTime || o.date || o.ts
      );
      const ronda = o.roundName || o.roundId || "—";
      const punto = o.pointName || o.point || o.pointId || "—";
      const oficial = resolveOfficerLabel(o);

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
    doc.text(
      "Resumen de rondas ejecutadas dentro del rango seleccionado",
      14,
      28
    );

    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${officerFilterLabel}`,
      `Generado: ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}`,
      `Total filas: ${rows.length}`,
    ];

    let y = 34;
    doc.setFontSize(9);
    metaLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 4;
    });

    // Usar campos reales del backend: siteName, roundName, puntosRegistrados, pasos, primeraMarca, ultimaMarca, duracionText
    const tableBody = rows.map((r, i) => {
      const guardLabel = resolveOfficerLabel(r);
      const site = r.siteName || r.site || "—";
      const round = r.roundName || r.round || r.roundId || "—";
      const puntos = r.puntosRegistrados ?? r.totalRounds ?? r.total ?? 0;
      const pasos = r.pasos ?? 0;
      const primera = formatDateTime(r.primeraMarca || r.firstAt);
      const ultima = formatDateTime(r.ultimaMarca || r.lastAt);
      const duracion = r.duracionText || r.duration || "—";

      return [
        i + 1,
        guardLabel,
        site,
        round,
        puntos,
        pasos,
        primera,
        ultima,
        duracion,
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
          "Puntos",
          "Pasos",
          "Primera marca",
          "Última marca",
          "Duración",
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

  /* ==================== PDF: ALERTAS DE PÁNICO (messages) ==================== */
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
      "Eventos de botón de pánico generados dentro del rango seleccionado",
      14,
      28
    );

    const metaLines = [
      `Rango: ${f.from || "—"}  —  ${f.to || "—"}`,
      `Sitio: ${siteLabel}   ·   Ronda: ${roundLabel}`,
      `Oficial: ${officerFilterLabel}`,
      `Generado: ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}`,
      `Total alertas: ${rows.length}`,
    ];

    let y = 34;
    doc.setFontSize(9);
    metaLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 4;
    });

    const tableBody = rows.map((m, i) => {
      const tipo = m.type || m.kind || m.level || "—";
      const fecha = formatDateTime(m.at || m.ts || m.date || m.createdAt);
      const sitio = m.siteName || m.site || "—";
      const ronda = m.roundName || m.round || "—";
      const oficial = resolveOfficerLabel(m);

      const baseText = m.text || m.message || m.description || m.detail || "—";
      const extras = [];
      if (typeof m.durationMin === "number") {
        extras.push(`Inactividad: ${m.durationMin} min`);
      }
      if (typeof m.stepsAtAlert === "number") {
        extras.push(`Pasos: ${m.stepsAtAlert}`);
      }
      if (m.fallDetected) {
        extras.push("Caída detectada");
      }
      const detalle =
        extras.length > 0 ? `${baseText} (${extras.join(" · ")})` : baseText;

      let gps = "—";
      if (
        m.gps &&
        typeof m.gps.lat === "number" &&
        typeof m.gps.lon === "number"
      ) {
        gps = `${m.gps.lat}, ${m.gps.lon}`;
      } else if (m.coordinates) {
        gps = String(m.coordinates);
      } else if (m.location) {
        gps = String(m.location);
      }

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
        5: { cellWidth: 30 },
        6: { cellWidth: 40 },
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
      orientation: "landscape",
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
      `Oficial: ${officerFilterLabel}`,
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
      const fecha = formatDateTime(r.at || r.ts || r.date || r.createdAt);
      const sitio = r.siteName || r.site || "—";
      const ronda = r.roundName || r.round || "—";
      const punto = r.pointName || r.point || r.pointId || "—";
      const oficial = resolveOfficerLabel(r);
      const enVentana =
        typeof r.onWindow === "boolean"
          ? r.onWindow
            ? "Sí"
            : "No"
          : "—";
      const mensaje = r.message || "—";

      return [i + 1, fecha, sitio, ronda, punto, oficial, enVentana, mensaje];
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
          "Mensaje",
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
        <div><b>Oficial:</b> ${officerFilterLabel}</div>
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
        const oficial = resolveOfficerLabel(o);
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
    if (f.reportType === "omissions") {
      exportOmissionsExcel();
      return;
    }

    try {
      setDownloading(true);
      const qs = new URLSearchParams(f).toString();
      const candidates = [
        rondasqrApi.xlsxUrl?.(f),
        // 👇 ruta real del backend
        `${ROOT}/api/rondasqr/v1/reports/export/excel?${qs}`,
        // rutas alternativas por compatibilidad
        `${ROOT}/api/rondasqr/v1/reports/excel?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/export/xlsx?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/xlsx?${qs}`,
      ].filter(Boolean);
      const ok = await openFirstOk(candidates);
      if (!ok)
        alert(
          "HTTP 404 - No se encontró endpoint de Excel. Verifica la ruta en el servidor."
        );
    } finally {
      setDownloading(false);
    }
  }

  async function doPdf() {
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

      const qs = new URLSearchParams(f).toString();
      const candidates = [
        rondasqrApi.pdfUrl?.(f),
        // 👇 ruta real del backend
        `${ROOT}/api/rondasqr/v1/reports/export/pdf?${qs}`,
        // rutas alternativas por compatibilidad
        `${ROOT}/api/rondasqr/v1/reports/pdf?${qs}`,
        `${ROOT}/api/rondasqr/v1/reports/export/report.pdf?${qs}`,
      ].filter(Boolean);
      const ok = await openFirstOk(candidates);
      if (!ok)
        alert(
          "HTTP 404 - No se encontró endpoint de PDF. Verifica la ruta en el servidor."
        );
    } finally {
      setDownloading(false);
    }
  }

  function doPrint() {
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

    const qs = new URLSearchParams(f).toString();
    const url =
      rondasqrApi.pdfUrl?.(f) ||
      `${ROOT}/api/rondasqr/v1/reports/export/pdf?${qs}`;
    window.open(url, "_blank");
  }

  // Banner suave
  const fromVar = readVar("--accent-from", "#38bdf8");
  const toVar = readVar("--accent-to", "#22d3ee");
  const alphaVar = parseFloat(readVar("--accent-alpha", "0.16")) || 0.16;
  const bannerStyle = {
    background: `linear-gradient(90deg, ${hexToRgba(
      fromVar,
      alphaVar
    )} 0%, ${hexToRgba(toVar, alphaVar)} 100%)`,
  };

  // Omisiones con nombre de oficial ya resuelto
  const decoratedOmissions = (data.omissions || []).map((o) => {
    const label = resolveOfficerLabel(o);
    return {
      ...o,
      officerName: label,
      officerLabel: label,
    };
  });

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
            <label className="text-[11px] text-white/70 mb-1">
              Sitio (opcional)
            </label>
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
            <label className="text-[11px] text-white/70 mb-1">
              Ronda (opcional)
            </label>
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

          {/* Oficial: SELECT de guardias, como en AssignmentsPage */}
          <div className="flex flex-col">
            <label className="text-[11px] text-white/70 mb-1">
              Oficial (opcional)
            </label>
            <select
              value={f.officer}
              onChange={setField("officer")}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {guards.map((g) => (
                <option key={g._id} value={g.opId}>
                  {getGuardLabel(g)}
                </option>
              ))}
            </select>
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

      {f.includeOmissions && (
        <OmissionsTable items={decoratedOmissions} />
      )}

      {f.includeMessages && (
        <MessagesTable items={data.messages} title="Alertas de pánico" />
      )}

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
