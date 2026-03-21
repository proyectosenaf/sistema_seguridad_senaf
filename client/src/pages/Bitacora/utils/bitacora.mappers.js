import {
  VISITAS_STORAGE_KEY,
  CITAS_STORAGE_KEY,
} from "../constants";
import { turnoFromDate, fmtDate } from "./bitacora.formatters";

export function normalizeBitacoraEvent(e) {
  return {
    id: e._id || e.id || cryptoRandom(),
    fecha: e.fecha || e.createdAt || new Date().toISOString(),
    agente: e.agente || e.guardName || e.officerName || "",
    turno: e.turno || turnoFromDate(new Date(e.fecha || e.createdAt || Date.now())),
    tipo: e.tipo || "Ronda",
    modulo: e.modulo || "Rondas de Vigilancia",
    descripcion: e.descripcion || "",
    prioridad: e.prioridad || "Media",
    estado: e.estado || "Firmado",
    nombre: e.nombre || "",
    empresa: e.empresa || "",
    source: e.source || "backend",
  };
}

export function loadLocalVisitasAsBitacoraRows() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VISITAS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    return arr.map((v) => {
      let entryAt = v.entryAt ? new Date(v.entryAt) : null;
      if (!(entryAt instanceof Date) || Number.isNaN(entryAt.getTime())) {
        entryAt = new Date();
      }

      const turno = turnoFromDate(entryAt);
      const fechaISO = entryAt.toISOString();

      const nombre = v.name || "Visitante";
      const empresa = v.company || "—";
      const empleado = v.employee || "—";
      const vehiculo = v.vehicleSummary || "—";
      const estadoVisita = v.status || "Dentro";

      return {
        id: `visit-${v.id || fechaISO}`,
        fecha: fechaISO,
        agente: "Recepción",
        turno,
        tipo: "Visita",
        modulo: "Control de Visitas",
        descripcion: `Visita presencial de ${nombre} (${empresa}) para ${empleado}. Vehículo: ${vehiculo}. Estado: ${estadoVisita}.`,
        prioridad: "Baja",
        estado: estadoVisita,
        nombre,
        empresa,
        source: "local-visitas",
      };
    });
  } catch (e) {
    console.warn("[bitacora] No se pudieron leer visitas desde localStorage:", e);
    return [];
  }
}

export function loadLocalCitasAsBitacoraRows() {
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

      if (!(citaAtDate instanceof Date) || Number.isNaN(citaAtDate.getTime())) {
        citaAtDate = new Date();
      }

      const fechaISO = citaAtDate.toISOString();
      const turno = turnoFromDate(citaAtDate);

      const nombre = c.nombre || c.visitante || "Visitante";
      const empresa = c.empresa || "—";
      const empleado = c.empleado || "—";
      const motivo = c.motivo || "—";
      const estadoCita = String(c.estado || "solicitada");
      const telefono = c.telefono || "";
      const correo = c.correo || "";
      const vehiculo =
        c.vehiculo && (c.vehiculo.marca || c.vehiculo.modelo || c.vehiculo.placa)
          ? `${c.vehiculo.marca || "N/D"} ${c.vehiculo.modelo || ""} ${
              c.vehiculo.placa ? `(${c.vehiculo.placa})` : ""
            }`
          : "—";

      return {
        id: `cita-${c._id || c.id || idx}`,
        fecha: fechaISO,
        agente: "Sistema de Citas",
        turno,
        tipo: "Visita",
        modulo: "Control de Visitas",
        descripcion: [
          `Cita en línea de ${nombre} (${empresa}) para ${empleado}.`,
          `Motivo: ${motivo}.`,
          `Fecha/Hora programadas: ${fmtDate(fechaISO)} ${c.hora || ""}.`,
          `Estado actual: ${estadoCita}.`,
          `Contacto: ${telefono || "N/D"}${correo ? `, ${correo}` : ""}.`,
          `Vehículo: ${vehiculo}.`,
        ].join(" "),
        prioridad: "Baja",
        estado: estadoCita,
        nombre,
        empresa,
        source: "local-citas",
      };
    });
  } catch (e) {
    console.warn("[bitacora] No se pudieron leer citas desde localStorage:", e);
    return [];
  }
}

export function mapAccesoToBitacoraRows(data) {
  const empleadosArr = Array.isArray(data?.items) ? data.items : [];
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
    if (Number.isNaN(fechaEmpDate.getTime())) fechaBase = new Date().toISOString();

    const fechaEmpISO = new Date(fechaBase).toISOString();
    const turnoEmp = turnoFromDate(new Date(fechaEmpISO));

    rowsAcceso.push({
      id: `acceso-emp-${e._id || id_persona || cryptoRandom()}`,
      fecha: fechaEmpISO,
      agente: "Sistema de Acceso",
      turno: turnoEmp,
      tipo: "Acceso",
      modulo: "Control de Acceso",
      descripcion: `Registro de empleado ${nombreCompleto || "sin nombre"} (ID: ${
        id_persona || "N/D"
      }) en el módulo de Control de Acceso. Departamento: ${
        departamento || "N/D"
      }. Estado actual: ${activo ? "Activo" : "Inactivo"}.`,
      prioridad: "Baja",
      estado: activo ? "Activo" : "Inactivo",
      nombre: nombreCompleto,
      empresa: "Interno",
      source: "acceso",
    });

    const vehs = Array.isArray(e.vehiculos) ? e.vehiculos : [];
    vehs.forEach((v, idx) => {
      const modelo = v.modelo || v.marcaModelo || v.marca || "";
      const placa = v.placa || v.noPlaca || "";
      const enEmpresa = typeof v.enEmpresa === "boolean" ? v.enEmpresa : false;

      let fechaVeh = v.createdAt || v.updatedAt || fechaEmpISO || new Date().toISOString();
      const fechaVehDate = new Date(fechaVeh);
      if (Number.isNaN(fechaVehDate.getTime())) fechaVeh = new Date().toISOString();

      const fechaVehISO = new Date(fechaVeh).toISOString();
      const turnoVeh = turnoFromDate(new Date(fechaVehISO));

      rowsAcceso.push({
        id: `acceso-veh-${v._id || placa || `${e._id || id_persona || "emp"}-${idx}-${cryptoRandom()}`}`,
        fecha: fechaVehISO,
        agente: "Sistema de Acceso",
        turno: turnoVeh,
        tipo: "Acceso",
        modulo: "Control de Acceso",
        descripcion: `Registro de vehículo ${modelo || "sin modelo"} con placa ${
          placa || "N/D"
        } asignado al empleado ${nombreCompleto || "N/D"} (ID: ${
          id_persona || "N/D"
        }). Estado en empresa: ${enEmpresa ? "Dentro" : "Fuera"}.`,
        prioridad: "Baja",
        estado: enEmpresa ? "En Empresa" : "Fuera",
        nombre: nombreCompleto,
        empresa: "Interno",
        source: "acceso",
      });
    });
  }

  return rowsAcceso;
}

export function mapRondasToBitacoraRows({ summary, detailed }) {
  const mensajes = Array.isArray(summary?.messages) ? summary.messages : [];
  const marcas = Array.isArray(detailed?.items) ? detailed.items : [];
  const rows = [];

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

    rows.push({
      id: m._id || `ronda-mark-${fechaDate.getTime()}-${cryptoRandom()}`,
      fecha,
      agente: m.officer || m.officerName || "Guardia",
      turno,
      tipo: "Ronda",
      modulo: "Rondas de Vigilancia",
      descripcion: descripcionPartes.join(" · "),
      prioridad: "Baja",
      estado: m.status || m.state || "Registrado",
      nombre: m.officer || m.officerName || "",
      empresa: "Interno",
      source: "rondas",
    });
  }

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
      typeof a.durationMin === "number" ? `Inactividad: ${a.durationMin} min` : "";
    const extraPasos =
      typeof a.stepsAtAlert === "number" ? `Pasos al momento: ${a.stepsAtAlert}` : "";

    const partes = [`Alerta de tipo "${tipoAlerta.toUpperCase()}" en "${site}"`];
    if (ronda) partes.push(`Ronda: ${ronda}`);
    partes.push(`Oficial: ${quien}`);
    if (texto) partes.push(`Detalle: ${texto}`);
    if (gps) partes.push(gps);
    if (extraInactividad) partes.push(extraInactividad);
    if (extraPasos) partes.push(extraPasos);

    rows.push({
      id: a._id || `ronda-alert-${fechaDate.getTime()}-${cryptoRandom()}`,
      fecha,
      agente: quien,
      turno,
      tipo: "Incidente",
      modulo: "Rondas de Vigilancia",
      descripcion: partes.join(" · "),
      prioridad,
      estado: a.status || a.state || "Abierto",
      nombre: quien,
      empresa: site,
      source: "rondas",
    });
  }

  return rows;
}

export function dedupeBitacoraRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      row.id,
      row.fecha,
      row.tipo,
      row.modulo,
      row.descripcion,
    ].filter(Boolean).join("|");

    if (!map.has(key)) map.set(key, row);
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2);
}