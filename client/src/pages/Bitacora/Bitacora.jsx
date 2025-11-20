// src/pages/bitacora/Bitacora.jsx
import React, { useEffect, useMemo, useState } from "react";
import { rondasqrApi } from "../../modules/rondasqr/api/rondasqrApi.js";

const COMPANY = "SENAF";

// Base de API para recopilar datos del módulo de Control de Acceso
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "/api";

/* ========= Helpers ========= */
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};
const clampTxt = (s, n = 80) => (s?.length > n ? s.slice(0, n - 1) + "…" : s);
const percent = (num, den) => (!den ? 0 : Math.round((num / den) * 100));
const monthNameES = (iso) =>
  new Date(iso).toLocaleDateString("es-PE", { month: "long", year: "numeric" });

/* ========= Módulos visibles ========= */
const MODULES = [
  "Control de Acceso",
  "Rondas de Vigilancia",
  "Control de Visitas",
];

/* ========= Tipos visibles (alineados a los módulos) ========= */
const TIPO_EVENTO_OPTS = ["Todos", "Acceso", "Ronda", "Visita"];

/* ========= Claves de storage para VISITAS y CITAS (módulo de Visitas) ========= */
const VISITAS_STORAGE_KEY = "visitas_demo";
const CITAS_STORAGE_KEY = "citas_demo";

/* ========= Helpers para recopilar VISITAS y CITAS del módulo de Visitas ========= */

// Turno aproximado según hora
function turnoFromDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "Mañana";
  const h = date.getHours();
  if (h < 12) return "Mañana";
  if (h < 19) return "Tarde";
  return "Noche";
}

// Lee visitas presenciales de localStorage (VISITAS_STORAGE_KEY)
function loadLocalVisitasAsBitacoraRows() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VISITAS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    return arr.map((v) => {
      // entryAt viene del módulo de Visitas; es la mejor referencia de fecha/hora
      let entryAt = v.entryAt ? new Date(v.entryAt) : null;
      if (!(entryAt instanceof Date) || isNaN(entryAt.getTime())) {
        entryAt = new Date();
      }
      const turno = turnoFromDate(entryAt);
      const fechaISO = entryAt.toISOString();

      const nombre = v.name || "Visitante";
      const empresa = v.company || "—";
      const empleado = v.employee || "—";
      const vehiculo = v.vehicleSummary || "—";
      const estadoVisita = v.status || "Dentro";

      const descripcion = `Visita presencial de ${nombre} (${empresa}) para ${empleado}. Vehículo: ${vehiculo}. Estado: ${estadoVisita}.`;

      return {
        id: `visit-${v.id || fechaISO}`,
        fecha: fechaISO,
        agente: "Recepción",
        turno,
        tipo: "Visita",
        modulo: "Control de Visitas",
        descripcion,
        prioridad: "Baja",
        estado: estadoVisita,
        nombre,
        empresa,
      };
    });
  } catch (e) {
    console.warn("[bitacora] No se pudieron leer visitas desde localStorage:", e);
    return [];
  }
}

// Lee citas (pre-registro en línea) de localStorage (CITAS_STORAGE_KEY)
function loadLocalCitasAsBitacoraRows() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CITAS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    return arr.map((c, idx) => {
      let citaAtDate = null;

      if (c.citaAt) {
        citaAtDate = new Date(c.citaAt);
      } else if (c.fecha && c.hora) {
        citaAtDate = new Date(`${c.fecha}T${c.hora}:00`);
      }

      if (!(citaAtDate instanceof Date) || isNaN(citaAtDate.getTime())) {
        citaAtDate = new Date();
      }

      const fechaISO = citaAtDate.toISOString();
      const turno = turnoFromDate(citaAtDate);

      const nombre = c.nombre || c.visitante || "Visitante";
      const empresa = c.empresa || "—";
      const empleado = c.empleado || "—";
      const motivo = c.motivo || "—";
      const estadoCita = (c.estado || "solicitada").toString();
      const telefono = c.telefono || "";
      const correo = c.correo || "";
      const vehiculo =
        c.vehiculo && (c.vehiculo.marca || c.vehiculo.modelo || c.vehiculo.placa)
          ? `${c.vehiculo.marca || "N/D"} ${c.vehiculo.modelo || ""} ${
              c.vehiculo.placa ? `(${c.vehiculo.placa})` : ""
            }`
          : "—";

      const descripcionLineas = [
        `Cita en línea de ${nombre} (${empresa}) para ${empleado}.`,
        `Motivo: ${motivo}.`,
        `Fecha/Hora programadas: ${fmtDate(fechaISO)} ${c.hora || ""}.`,
        `Estado actual: ${estadoCita}.`,
        `Contacto: ${telefono || "N/D"}${correo ? `, ${correo}` : ""}.`,
        `Vehículo: ${vehiculo}.`,
      ];

      const descripcion = descripcionLineas.join(" ");

      return {
        id: `cita-${c._id || c.id || idx}`,
        fecha: fechaISO,
        agente: "Sistema de Citas",
        turno,
        tipo: "Visita",
        modulo: "Control de Visitas",
        descripcion,
        prioridad: "Baja",
        estado: estadoCita,
        nombre,
        empresa,
      };
    });
  } catch (e) {
    console.warn("[bitacora] No se pudieron leer citas desde localStorage:", e);
    return [];
  }
}

/* ========= NUEVO: Recopilar datos de Control de Acceso (empleados y vehículos) ========= */

async function fetchAccesoAsBitacoraRows() {
  try {
    const opts = { credentials: "include" };
    let res = await fetch(`${API_BASE}/acceso/empleados-vehiculos`, opts);
    let data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false || !Array.isArray(data?.items)) {
      res = await fetch(`${API_BASE}/acceso/empleados`, opts);
      data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false || !Array.isArray(data?.items)) {
        return [];
      }
    }

    const empleadosArr = Array.isArray(data.items) ? data.items : [];
    const rowsAcceso = [];

    for (const e of empleadosArr) {
      const nombreCompleto = e.nombreCompleto || e.nombre || "";
      const id_persona =
        e.id_persona || e.idPersona || e.codigoInterno || e.idInterno || "";
      const departamento = e.departamento || e.depto || "";
      const activo = typeof e.activo === "boolean" ? e.activo : true;

      let fechaBase =
        e.fechaIngreso || e.createdAt || e.updatedAt || new Date().toISOString();
      const fechaEmpDate = new Date(fechaBase);
      if (isNaN(fechaEmpDate.getTime())) {
        fechaBase = new Date().toISOString();
      }
      const fechaEmpISO = new Date(fechaBase).toISOString();
      const turnoEmp = turnoFromDate(new Date(fechaEmpISO));

      // Registro de empleado
      rowsAcceso.push({
        id: `acceso-emp-${e._id || id_persona || Math.random().toString(36).slice(2)}`,
        fecha: fechaEmpISO,
        agente: "Sistema de Acceso",
        turno: turnoEmp,
        tipo: "Acceso",
        modulo: "Control de Acceso",
        descripcion: `Registro de empleado ${
          nombreCompleto || "sin nombre"
        } (ID: ${
          id_persona || "N/D"
        }) en el módulo de Control de Acceso. Departamento: ${
          departamento || "N/D"
        }. Estado actual: ${activo ? "Activo" : "Inactivo"}.`,
        prioridad: "Baja",
        estado: activo ? "Activo" : "Inactivo",
        nombre: nombreCompleto,
        empresa: "Interno",
      });

      const vehs = Array.isArray(e.vehiculos) ? e.vehiculos : [];
      vehs.forEach((v, idx) => {
        const modelo = v.modelo || v.marcaModelo || v.marca || "";
        const placa = v.placa || v.noPlaca || "";
        const enEmpresa =
          typeof v.enEmpresa === "boolean" ? v.enEmpresa : false;

        let fechaVeh =
          v.createdAt || v.updatedAt || fechaEmpISO || new Date().toISOString();
        const fechaVehDate = new Date(fechaVeh);
        if (isNaN(fechaVehDate.getTime())) {
          fechaVeh = new Date().toISOString();
        }
        const fechaVehISO = new Date(fechaVeh).toISOString();
        const turnoVeh = turnoFromDate(new Date(fechaVehISO));

        rowsAcceso.push({
          id: `acceso-veh-${
            v._id ||
            placa ||
            `${e._id || id_persona || "emp"}-${idx}-${Math.random()
              .toString(36)
              .slice(2)}`
          }`,
          fecha: fechaVehISO,
          agente: "Sistema de Acceso",
          turno: turnoVeh,
          tipo: "Acceso",
          modulo: "Control de Acceso",
          descripcion: `Registro de vehículo ${
            modelo || "sin modelo"
          } con placa ${placa || "N/D"} asignado al empleado ${
            nombreCompleto || "N/D"
          } (ID: ${id_persona || "N/D"}). Estado en empresa: ${
            enEmpresa ? "Dentro" : "Fuera"
          }.`,
          prioridad: "Baja",
          estado: enEmpresa ? "En Empresa" : "Fuera",
          nombre: nombreCompleto,
          empresa: "Interno",
        });
      });
    }

    return rowsAcceso;
  } catch (err) {
    console.warn("[bitacora] No se pudieron leer datos de Control de Acceso:", err);
    return [];
  }
}

/* ========= NUEVO: Recopilar datos del módulo de RONDAS (ingreso de datos) ========= */
/**
 * Toma los datos de reportes de Rondas QR:
 * - Marcas detalladas (check-ins)
 * - Mensajes / alertas (panic, fall, inactivity, etc.)
 * y los convierte a filas de bitácora.
 */
async function fetchRondasAsBitacoraRows() {
  try {
    if (!rondasqrApi) return [];

    const hoy = new Date();
    const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000); // últimos 7 días
    const filtro = {
      from: hace7.toISOString().slice(0, 10),
      to: hoy.toISOString().slice(0, 10),
      siteId: "",
      roundId: "",
      officer: "",
    };

    let summary = null;
    let detailed = null;

    if (typeof rondasqrApi.getSummary === "function") {
      summary = await rondasqrApi.getSummary(filtro).catch(() => null);
    }
    if (typeof rondasqrApi.getDetailed === "function") {
      detailed = await rondasqrApi.getDetailed(filtro).catch(() => null);
    }

    const mensajes = Array.isArray(summary?.messages) ? summary.messages : [];
    const marcas = Array.isArray(detailed?.items) ? detailed.items : [];

    const rows = [];

    // 🔹 Marcas (check-ins de rondas)
    for (const m of marcas) {
      const fecha = m.at || m.ts || m.date || m.createdAt || new Date().toISOString();
      const fechaDate = new Date(fecha);
      const turno = turnoFromDate(fechaDate);

      const site = m.site || m.siteName || "Sitio sin nombre";
      const ronda = m.round || m.roundName || "Ronda sin nombre";
      const punto = m.point || m.pointName || "Punto sin nombre";
      const qr = m.qr || m.hardwareId || "";
      const pasos = typeof m.steps === "number" ? m.steps : null;
      const msg = m.message || m.text || "";

      const descripcionPartes = [
        `Marcación de ronda en "${site}" / "${ronda}"`,
        `Punto: ${punto}`,
      ];
      if (qr) descripcionPartes.push(`QR: ${qr}`);
      if (msg) descripcionPartes.push(`Mensaje: ${msg}`);
      if (pasos != null) descripcionPartes.push(`Pasos: ${pasos}`);

      const descripcion = descripcionPartes.join(" · ");

      rows.push({
        id:
          m._id ||
          `ronda-mark-${fechaDate.getTime()}-${Math.random()
            .toString(36)
            .slice(2)}`,
        fecha,
        agente: m.officer || m.officerName || "Guardia",
        turno,
        tipo: "Ronda",
        modulo: "Rondas de Vigilancia",
        descripcion,
        prioridad: "Baja",
        estado: m.status || m.state || "Registrado",
        nombre: m.officer || m.officerName || "",
        empresa: "Interno",
      });
    }

    // 🔹 Mensajes / Alertas (panic, fall, inactivity, noncompliance, incident, custom)
    for (const a of mensajes) {
      const fecha = a.at || a.ts || a.date || a.createdAt || new Date().toISOString();
      const fechaDate = new Date(fecha);
      const turno = turnoFromDate(fechaDate);

      const tipoAlerta = (a.type || a.kind || "incident").toLowerCase();
      let prioridad = "Media";
      if (tipoAlerta === "panic") prioridad = "Alta";
      if (tipoAlerta === "fall" || tipoAlerta === "inactivity") prioridad = "Media";

      const site = a.siteName || a.site || "Sitio sin nombre";
      const ronda = a.roundName || a.round || "";
      const quien =
        a.officerName ||
        a.officerEmail ||
        a.guardName ||
        a.guardEmail ||
        "Guardia";

      const texto = a.text || a.message || a.description || a.detail || "";
      const gps =
        a.gps && typeof a.gps.lat === "number" && typeof a.gps.lon === "number"
          ? `GPS: ${a.gps.lat.toFixed(6)}, ${a.gps.lon.toFixed(6)}`
          : "";

      const extraInactividad =
        typeof a.durationMin === "number"
          ? `Inactividad: ${a.durationMin} min`
          : "";
      const extraPasos =
        typeof a.stepsAtAlert === "number"
          ? `Pasos al momento: ${a.stepsAtAlert}`
          : "";

      const partes = [
        `Alerta de tipo "${tipoAlerta.toUpperCase()}" en "${site}"`,
      ];
      if (ronda) partes.push(`Ronda: ${ronda}`);
      partes.push(`Oficial: ${quien}`);
      if (texto) partes.push(`Detalle: ${texto}`);
      if (gps) partes.push(gps);
      if (extraInactividad) partes.push(extraInactividad);
      if (extraPasos) partes.push(extraPasos);

      const descripcion = partes.join(" · ");

      rows.push({
        id:
          a._id ||
          `ronda-alert-${fechaDate.getTime()}-${Math.random()
            .toString(36)
            .slice(2)}`,
        fecha,
        agente: quien,
        turno,
        tipo: "Incidente",
        modulo: "Rondas de Vigilancia",
        descripcion,
        prioridad,
        estado: a.status || a.state || "Abierto",
        nombre: quien,
        empresa: site,
      });
    }

    return rows;
  } catch (err) {
    console.warn("[bitacora] No se pudieron leer datos de Rondas QR:", err);
    return [];
  }
}

/* ========= Pills ========= */
const Pill = ({ children, tone = "muted" }) => {
  const tones = {
    muted:
      "bg-black/5 text-neutral-800 dark:bg-white/10 dark:text-neutral-100 border border-black/5 dark:border-white/10",
    alta:
      "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/30",
    media:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/30",
    baja:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
    abierto:
      "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-400/30",
    proceso:
      "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-400/30",
    resuelto:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
    firmado:
      "bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:border-white/15",
    activo:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
    completado:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-100 dark:border-blue-400/30",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
        tones[tone] || tones.muted
      }`}
    >
      {children}
    </span>
  );
};
const prioridadTone = (p) =>
  ({ alta: "alta", media: "media", baja: "baja" }[(p || "").toLowerCase()] ||
  "muted");
const estadoTone = (e) => {
  const k = (e || "").toLowerCase();
  if (k.includes("abierto")) return "abierto";
  if (k.includes("proceso")) return "proceso";
  if (k.includes("resuelto")) return "resuelto";
  if (k.includes("firmado")) return "firmado";
  if (k.includes("activo")) return "activo";
  if (k.includes("completado")) return "completado";
  return "muted";
};

/* ========= Barra de progreso ========= */
function Progress({ value = 0, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full">
      {label && <div className="text-xs mb-1 opacity-80">{label}</div>}
      <div className="h-2 rounded-full bg-black/5 dark:bg:white/10 overflow-hidden">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${v}%`,
            background: "linear-gradient(90deg, var(--fx1), var(--fx2))",
          }}
        />
      </div>
    </div>
  );
}

/* ========= EXCEL (HTML con estilo) ========= */
function buildExcelHTML({ rows, stats, title = "Bitácora — Exporte" }) {
  const css = `
  *{ box-sizing:border-box; font-family: Calibri, Arial, sans-serif; }
  body{ color:#0b132b; padding:16px; }
  header{ display:flex; justify-content:space-between; align-items:flex-start; }
  .company{ font-size:22px; font-weight:800; letter-spacing:.5px; margin-bottom:4px; }
  .meta{ text-align:right; font-size:12px; color:#334155; line-height:1.25; }
  .title{ font-size:28px; font-weight:800; margin:10px 0 8px; }
  .chips{ display:flex; gap:10px; margin: 4px 0 14px; }
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
  const html = `
  <!doctype html><html><head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>${css}</style>
  </head><body>
    <header>
      <div class="company">${COMPANY}</div>
      <div class="meta">
        <div><strong>Fecha:</strong> ${now.toLocaleDateString()} — <strong>Hora:</strong> ${now.toLocaleTimeString()}</div>
        <div><strong>Periodo:</strong> Todos los periodos</div>
      </div>
    </header>

    <div class="title">${title}</div>
    <div class="chips">
      <span class="chip">Registros: ${stats.registros}</span>
      <span class="chip">Incidentes: ${stats.incidentes}</span>
      <span class="chip">Rondas: ${stats.rondas}</span>
      <span class="chip">Visitas: ${stats.visitas}</span>
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
          <td>${r.agente || r.nombre || ""}</td>
          <td>${fmtDate(r.fecha)}</td>
          <td>${r.turno || ""}</td>
          <td>${r.tipo || ""}</td>
          <td>${r.modulo || ""}</td>
          <td>${r.prioridad || ""}</td>
          <td>${r.estado || ""}</td>
          <td class="desc">${(r.descripcion || "").replace(/</g, "&lt;")}</td>
        </tr>`
        )
        .join("")}
    </table>
  </body></html>`;
  return html;
}

/* ========= PDF ========= */
function buildPDFHTML({ rows, stats }) {
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
  const html = `
  <!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <header>
      <div class="company">${COMPANY}</div>
      <div><strong>Fecha:</strong> ${now.toLocaleDateString()} — <strong>Hora:</strong> ${now.toLocaleTimeString()} <span style="margin-left:10px"></span><strong>Periodo:</strong> Todos los periodos</div>
    </header>

    <h1>Bitácora — Reporte (Filtrado)</h1>
    <div className="pills">
      <span className="pill">Registros: ${stats.registros}</span>
      <span className="pill">Incidentes: ${stats.incidentes}</span>
      <span className="pill">Rondas: ${stats.rondas}</span>
      <span className="pill">Visitas: ${stats.visitas}</span>
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
            <td>${r.agente || r.nombre || ""}</td>
            <td>${fmtDate(r.fecha)}</td>
            <td>${r.turno || ""}</td>
            <td>${r.tipo || ""}</td>
            <td>${r.modulo || ""}</td>
            <td>${r.prioridad || ""}</td>
            <td>${r.estado || ""}</td>
            <td class="desc">${(r.descripcion || "").replace(/</g,"&lt;")}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <footer>(Generado por el sistema de bitacora-SENAF)</footer>
  </body></html>`;
  return html;
}

/* ========= Componente ========= */
export default function Bitacora() {
  const [tab, setTab] = useState("bitacora");
  const [rows, setRows] = useState([]); // 🔁 sin DEMO
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ===== Filtros aplicados (se usan para filtrar la tabla)
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fAgente, setFAgente] = useState("");
  const [fTurno, setFTurno] = useState("Todos");
  const [fTipo, setFTipo] = useState("Todos"); // Acceso | Ronda | Visita | Todos
  const [fModulo, setFModulo] = useState("Todos"); // 3 módulos + Todos

  // ===== Controles (estado temporal del formulario)
  const [tmpDesde, setTmpDesde] = useState("");
  const [tmpHasta, setTmpHasta] = useState("");
  const [tmpAgente, setTmpAgente] = useState("");
  const [tmpTurno, setTmpTurno] = useState("Todos");
  const [tmpTipo, setTmpTipo] = useState("Todos");
  const [tmpModulo, setTmpModulo] = useState("Todos");

  // 🔄 Cargar registros desde el backend + VISITAS PRESENCIALES + CITAS EN LÍNEA + CONTROL DE ACCESO + RONDAS
  useEffect(() => {
    let isMounted = true;

    async function fetchBitacora() {
      try {
        const res = await fetch("/api/bitacora/v1/events");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const items = Array.isArray(data.items) ? data.items : [];

        const mapped = items.map((e) => ({
          id: e._id || e.id,
          fecha: e.fecha || e.createdAt,
          agente: e.agente || e.guardName || "",
          turno: e.turno || "",
          tipo: e.tipo || "Ronda",
          modulo: e.modulo || "Rondas de Vigilancia",
          descripcion: e.descripcion || "",
          prioridad: e.prioridad || "Media",
          estado: e.estado || "Firmado",
          nombre: e.nombre || "",
          empresa: e.empresa || "",
        }));

        // 🔹 Recopilar visitas presenciales y citas en línea del módulo de Visitas
        const visitasLocal = loadLocalVisitasAsBitacoraRows();
        const citasLocal = loadLocalCitasAsBitacoraRows();
        const extraVisitas = [...visitasLocal, ...citasLocal];

        // 🔹 Recopilar registros de Control de Acceso (empleados y vehículos)
        const accesoRows = await fetchAccesoAsBitacoraRows().catch(() => []);

        // 🔹 Recopilar registros desde Rondas QR (marcas + alertas)
        const rondasRows = await fetchRondasAsBitacoraRows().catch(() => []);

        if (!isMounted) return;

        const base = mapped.length ? mapped : [];
        setRows(base.concat(extraVisitas, accesoRows, rondasRows));
        setLoadError("");
      } catch (err) {
        console.error("[bitacora] error cargando eventos:", err);
        if (!isMounted) return;

        // Incluso en modo demo, anexamos las visitas/citas locales si existen
        const visitasLocal = loadLocalVisitasAsBitacoraRows();
        const citasLocal = loadLocalCitasAsBitacoraRows();
        const extraVisitas = [...visitasLocal, ...citasLocal];

        // También intentamos anexar datos de Control de Acceso
        const accesoRows = await fetchAccesoAsBitacoraRows().catch(() => []);

        // Y datos de Rondas QR
        const rondasRows = await fetchRondasAsBitacoraRows().catch(() => []);

        setRows(extraVisitas.concat(accesoRows, rondasRows));
        setLoadError(
          "No se pudo cargar la bitácora en tiempo real. Se muestran datos de ejemplo."
        );
      } finally {
        isMounted && setLoading(false);
      }
    }

    fetchBitacora();
    return () => {
      isMounted = false;
    };
  }, []);

  // Aplicar filtros cuando el usuario pulsa "Buscar"
  const applyFilters = () => {
    setFDesde(tmpDesde || "");
    setFHasta(tmpHasta || "");
    setFAgente(tmpAgente || "");
    setFTurno(tmpTurno || "Todos");
    setFTipo(tmpTipo || "Todos");
    setFModulo(tmpModulo || "Todos");
  };

  // Limpiar filtros: aplicado + controles
  const clearFilters = () => {
    setFDesde("");
    setFHasta("");
    setFAgente("");
    setFTurno("Todos");
    setFTipo("Todos");
    setFModulo("Todos");
    setTmpDesde("");
    setTmpHasta("");
    setTmpAgente("");
    setTmpTurno("Todos");
    setTmpTipo("Todos");
    setTmpModulo("Todos");
  };

  // Opciones dinámicas de Turno (incluye "Todos")
  const turnos = useMemo(
    () => ["Todos", ...Array.from(new Set(rows.map((r) => r.turno))).sort()],
    [rows]
  );

  // Filtrado real (usa los estados aplicados f*)
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // ✅ Mostrar SOLO los 3 módulos requeridos en la tabla
      if (!MODULES.includes(r.modulo)) return false;

      if (fDesde && new Date(r.fecha) < new Date(`${fDesde}T00:00:00`))
        return false;
      if (fHasta && new Date(r.fecha) > new Date(`${fHasta}T23:59:59`))
        return false;

      // ✅ Búsqueda por agente/nombre case-insensitive
      if (
        fAgente &&
        !(`${r.agente || ""} ${r.nombre || ""}`
          .toLowerCase()
          .includes(fAgente.toLowerCase()))
      )
        return false;

      if (fTurno !== "Todos" && r.turno !== fTurno) return false;
      if (fTipo !== "Todos" && r.tipo !== fTipo) return false;
      if (fModulo !== "Todos" && r.modulo !== fModulo) return false;
      return true;
    });
  }, [rows, fDesde, fHasta, fAgente, fTurno, fTipo, fModulo]);

  // KPIs basados en los registros filtrados
  const visitas = filtered.filter((r) => r.tipo === "Visita");
  const visitasActivas = visitas.filter((v) => /activo/i.test(v.estado)).length;
  const incidentes = filtered.filter((r) => r.tipo === "Incidente");
  const incidentesPend = incidentes.filter((v) =>
    /abierto|proceso/i.test(v.estado)
  ).length;

  // 🔁 Contador de rondas: cuenta registros de tipo "Ronda" o del módulo "Rondas de Vigilancia"
  const rondas = filtered.filter(
    (r) => r.tipo === "Ronda" || r.modulo === "Rondas de Vigilancia"
  );
  const rondasHechas = rondas.length;

  const accesosTotal = filtered.filter((r) => r.tipo === "Acceso").length;
  const incRecientes = [...incidentes]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 3);

  // Exportes de filtrados
  const exportFilteredExcelStyled = () => {
    const stats = {
      registros: filtered.length,
      incidentes: filtered.filter((r) => r.tipo === "Incidente").length,
      rondas: filtered.filter((r) => r.tipo === "Ronda").length,
      visitas: filtered.filter((r) => r.tipo === "Visita").length,
    };
    const html = buildExcelHTML({
      rows: filtered,
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
  };

  const exportFilteredPDF = () => {
    const stats = {
      registros: filtered.length,
      incidentes: filtered.filter((r) => r.tipo === "Incidente").length,
      rondas: filtered.filter((r) => r.tipo === "Ronda").length,
      visitas: filtered.filter((r) => r.tipo === "Visita").length,
    };
    const html = buildPDFHTML({ rows: filtered, stats });
    const w = window.open("", "_blank");
    if (!w) return alert("Permite la ventana emergente para descargar el PDF.");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  // Estados para Ver/Eliminar
  const [view, setView] = useState(null);
  const [confirmRow, setConfirmRow] = useState(null);
  const requestDelete = (row) => setConfirmRow(row);

  const doDelete = async () => {
    if (!confirmRow) return;
    const rowId = confirmRow._id || confirmRow.id;

    // 🔥 Eliminar también de las fuentes locales (visitas/citas) para que sea permanente
    if (typeof window !== "undefined" && rowId) {
      const idStr = String(rowId);
      try {
        if (idStr.startsWith("visit-")) {
          const suffix = idStr.slice("visit-".length);
          const raw = window.localStorage.getItem(VISITAS_STORAGE_KEY);
          if (raw) {
            const arr = JSON.parse(raw) || [];
            const filteredLocal = arr.filter((v) => {
              const baseId = v.id ? String(v.id) : "";
              const altId = v.entryAt ? String(v.entryAt) : "";
              return baseId !== suffix && altId !== suffix;
            });
            window.localStorage.setItem(
              VISITAS_STORAGE_KEY,
              JSON.stringify(filteredLocal)
            );
          }
        } else if (idStr.startsWith("cita-")) {
          const suffix = idStr.slice("cita-".length);
          const raw = window.localStorage.getItem(CITAS_STORAGE_KEY);
          if (raw) {
            const arr = JSON.parse(raw) || [];
            const filteredLocal = arr.filter((c, idx) => {
              const baseId = c._id || c.id || idx;
              return String(baseId) !== suffix;
            });
            window.localStorage.setItem(
              CITAS_STORAGE_KEY,
              JSON.stringify(filteredLocal)
            );
          }
        }
      } catch (e) {
        console.warn("[bitacora] error limpiando almacenamiento local:", e);
      }
    }

    setConfirmRow(null);
    if (view && (view._id || view.id) === rowId) setView(null);

    setRows((prev) => prev.filter((r) => (r._id || r.id) !== rowId));

    try {
      if (rowId) {
        await fetch(`/api/bitacora/v1/events/${rowId}`, { method: "DELETE" });
      }
    } catch (err) {
      console.error("[bitacora] error eliminando evento:", err);
    }
  };

  return (
    <div className="layer-content" data-fx="neon" data-aurora="medio">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold">BITÁCORA</h1>
          <p className="text-sm opacity-75">
            Registro consolidado de todas las actividades del sistema
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm mb-2 opacity-70">
          Cargando registros de bitácora…
        </p>
      )}
      {/* Mensaje de error oculto: se deja la lógica pero no se renderiza */}
      {/* {loadError && !loading && (
        <p className="text-xs mb-2 text-amber-500">{loadError}</p>
      )} */}

      {/* Tabs (solo Bitácora y Análisis y Métricas) */}
      <div className="grid grid-cols-2 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden mb-4">
        {[
          { id: "bitacora", label: "Bitácora" },
          { id: "analitica", label: "Análisis y Métricas" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2 text-sm font-medium ${
              tab === t.id
                ? "bg-black/5 dark:bg:white/10"
                : "bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: Bitácora ===== */}
      {tab === "bitacora" && (
        <>
          {/* KPIs principales */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Total Visitas</h4>
                <span>👥</span>
              </div>
              <div className="text-3xl font-bold mt-1">{visitas.length}</div>
              <div className="text-sm opacity-75">
                {visitasActivas} activas
              </div>
            </div>

            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Rondas</h4>
                <span>⭕</span>
              </div>
              <div className="text-3xl font-bold mt-1">{rondasHechas}</div>
              <div className="text-sm opacity-75">de {3} programadas</div>
            </div>

            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Total Accesos</h4>
                <span>🛂</span>
              </div>
              <div className="text-3xl font-bold mt-1">{accesosTotal}</div>
              <div className="text-sm opacity-75">registros de acceso</div>
            </div>
          </section>

          {/* Filtros */}
          <section className="fx-card mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
              <span>🔎</span> Filtros de Búsqueda
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-sm mb-1">Fecha Desde</label>
                <input
                  type="date"
                  className="input-fx input-fx--with-bubble"
                  value={tmpDesde}
                  onChange={(e) => setTmpDesde(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Fecha Hasta</label>
                <input
                  type="date"
                  className="input-fx input-fx--with-bubble"
                  value={tmpHasta}
                  onChange={(e) => setTmpHasta(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Agente</label>
                <input
                  className="input-fx"
                  value={tmpAgente}
                  onChange={(e) => {
                    const soloLetras = e.target.value.replace(
                      /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,
                      ""
                    );
                    setTmpAgente(soloLetras);
                  }}
                  placeholder="Buscar agente…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Turno</label>
                <select
                  className="input-fx"
                  value={tmpTurno}
                  onChange={(e) => setTmpTurno(e.target.value)}
                >
                  {turnos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Tipo de Evento</label>
                <select
                  className="input-fx"
                  value={tmpTipo}
                  onChange={(e) => setTmpTipo(e.target.value)}
                >
                  {TIPO_EVENTO_OPTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Módulo</label>
                <select
                  className="input-fx"
                  value={tmpModulo}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTmpModulo(value); // estado del control
                    setFModulo(value); // 🔁 aplica filtro inmediatamente
                  }}
                >
                  {["Todos", ...MODULES].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={applyFilters}
                className="rounded-xl px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-black/5 dark:bg:white/5 hover:bg-black/10 dark:hover:bg-white/10"
              >
                Buscar
              </button>
              <button
                onClick={clearFilters}
                className="rounded-xl px-3 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Limpiar Filtros
              </button>
              <button
                onClick={exportFilteredExcelStyled}
                className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Exportar Filtrados (.XLS con estilo)
              </button>
              <button
                onClick={exportFilteredPDF}
                className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Descargar PDF
              </button>
            </div>
          </section>

          {/* Tabla */}
          <section className="fx-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <span>🗂️</span> Registro de Eventos ({filtered.length})
                </h3>
                <p className="text-sm opacity-75">
                  Historial cronológico de todas las actividades del sistema
                </p>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="py-2 pr-3 font-bold">Fecha y Hora</th>
                    <th className="py-2 pr-3 font-bold">Agente</th>
                    <th className="py-2 pr-3 font-bold">Turno</th>
                    <th className="py-2 pr-3 font-bold">Módulo</th>
                    <th className="py-2 pr-3 font-bold">Descripción</th>
                    <th className="py-2 pr-3 font-bold">Prioridad</th>
                    <th className="py-2 pr-3 font-bold">Estado</th>
                    <th className="py-2 pr-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id || r._id}
                      className="border-b border-neutral-200/70 dark:border-neutral-800/70 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <div className="font-semibold">
                          {fmtDateTime(r.fecha)}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{r.agente}</td>
                      <td className="py-2 pr-3">{r.turno}</td>
                      <td className="py-2 pr-3">{r.modulo}</td>
                      <td className="py-2 pr-3">
                        <span title={r.descripcion}>
                          {clampTxt(r.descripcion, 90)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <Pill tone={prioridadTone(r.prioridad)}>
                          {r.prioridad}
                        </Pill>
                      </td>
                      <td className="py-2 pr-3">
                        <Pill tone={estadoTone(r.estado)}>{r.estado}</Pill>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          <button
                            className="rounded-lg px-2 py-1 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg:white/5"
                            onClick={() => setView(r)}
                          >
                            Ver
                          </button>
                          <button
                            className="rounded-lg px-2 py-1 border border-rose-300 text-rose-700 dark:border-rose-600 dark:text-rose-300 hover:bg-rose-500/10"
                            onClick={() => setConfirmRow(r)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-6 text-center opacity-70"
                      >
                        No hay resultados con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ===== TAB: Análisis y Métricas ===== */}
      {tab === "analitica" && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="fx-card">
            <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
              <span>📊</span> Eventos por Módulo
            </h3>
            <div className="space-y-3">
              {MODULES.map((mod) => {
                const total = rows.length || 1;
                const count = rows.filter((r) => r.modulo === mod).length;
                const pctVal = percent(count, total);
                return (
                  <div key={mod} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{mod}</span>
                      <span className="opacity-75">
                        {count} eventos ({pctVal}
                        %)
                      </span>
                    </div>
                    <Progress value={pctVal} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fx-card">
            <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
              <span>🕒</span> Distribución por Turno
            </h3>
            <div className="space-y-3">
              {["Mañana", "Tarde", "Noche"].map((turno) => {
                const total = rows.length || 1;
                const count = rows.filter((r) => r.turno === turno).length;
                const pctVal = percent(count, total);
                return (
                  <div key={turno} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Turno {turno}</span>
                      <span className="opacity-75">
                        {count} eventos ({pctVal}
                        %)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${pctVal}%`,
                          background:
                            "linear-gradient(90deg, var(--fx2), var(--fx3))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== Modales: Ver / Confirmar eliminación ===== */}
      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setView(null)}
          />
          <div className="relative w-full max-w-xl card-rich layer-content">
            <div className="flex items-center justify-between px-4 pt-4">
              <h3 className="text-lg section-title">Detalle del Evento</h3>
              <button
                onClick={() => setView(null)}
                className="rounded-lg px-3 py-1.5 border border-neutral-300 dark:border-neutral-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="fx-tile p-3">
                  <div className="text-xs opacity-70">Fecha y Hora</div>
                  <div className="font-semibold">
                    {fmtDateTime(view.fecha)}
                  </div>
                </div>
                <div className="fx-tile p-3">
                  <div className="text-xs opacity-70">Agente</div>
                  <div className="font-semibold">
                    {view.agente || "—"}
                  </div>
                </div>
                <div className="fx-tile p-3">
                  <div className="text-xs opacity-70">Turno</div>
                  <div className="font-semibold">{view.turno}</div>
                </div>
                <div className="fx-tile p-3">
                  <div className="text-xs opacity-70">Módulo</div>
                  <div className="font-semibold">{view.modulo}</div>
                </div>
                <div className="fx-tile p-3">
                  <div className="text-xs opacity-70">Tipo</div>
                  <div className="font-semibold">{view.tipo}</div>
                </div>
                <div className="fx-tile p-3 flex items-center gap-2">
                  <div className="text-xs opacity-70">Prioridad</div>
                  <Pill tone={prioridadTone(view.prioridad)}>
                    {view.prioridad}
                  </Pill>
                </div>
                <div className="fx-tile p-3 flex items-center gap-2">
                  <div className="text-xs opacity-70">Estado</div>
                  <Pill tone={estadoTone(view.estado)}>{view.estado}</Pill>
                </div>
              </div>

              <div className="fx-card">
                <div className="text-sm opacity-70 mb-1">Descripción</div>
                <div className="leading-relaxed whitespace-pre-wrap">
                  {view.descripcion || "—"}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setView(null)}
                  className="rounded-lg px-3 py-2 border border-neutral-300 dark:border-neutral-700"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => setConfirmRow(view)}
                  className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 dark:border-rose-600 dark:text-rose-300 hover:bg-rose-500/10"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmRow && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmRow(null)}
          />
          <div className="relative w-full max-w-lg rounded-2xl shadow-xl border border-neutral-700/40 bg-neutral-900/95 text-neutral-100 layer-content">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-600/20 text-rose-400">
                  !
                </span>
                <h3 className="font-semibold">Confirmar eliminación</h3>
              </div>
            </div>
            <div className="p-5 space-y-2">
              <p className="leading-relaxed">
                ¿Eliminar el{" "}
                <strong>
                  {(confirmRow.tipo || "evento").toLowerCase()}
                </strong>{" "}
                de{" "}
                <strong>
                  {confirmRow.agente || confirmRow.nombre || "—"}
                </strong>{" "}
                correspondiente a{" "}
                <strong>{monthNameES(confirmRow.fecha)}</strong>?
              </p>
              <p className="opacity-80">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border:white/10">
              <button
                onClick={() => setConfirmRow(null)}
                className="rounded-lg px-4 py-2 border border-white/15 hover:bg:white/10"
              >
                Cancelar
              </button>
              <button
                onClick={doDelete}
                className="rounded-lg px-4 py-2 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
