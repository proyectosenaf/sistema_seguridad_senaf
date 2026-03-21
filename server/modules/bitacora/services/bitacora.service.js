import BitacoraEvent from "../models/BitacoraEvent.model.js";

import MovimientoVehiculo from "../../controldeacceso/models/MovimientoVehiculo.js";
import MovimientoManual from "../../controldeacceso/models/MovimientoManual.js";
import Visita from "../../visitas/visitas.model.js";
import RqMark from "../../rondasqr/models/RqMark.model.js";
import IncidentGlobal from "../../incidentes/models/incident.model.js";

/* =========================================================
   Helpers
========================================================= */

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function turnoFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Mañana";
  const h = date.getHours();
  if (h < 12) return "Mañana";
  if (h < 19) return "Tarde";
  return "Noche";
}

function normalizeString(value) {
  return String(value || "").trim();
}

function buildEventKey(prefix, mongoId) {
  return `${prefix}:${String(mongoId)}`;
}

function formatVehiculoVisita(v) {
  const veh = v.vehiculo && typeof v.vehiculo === "object" ? v.vehiculo : null;
  if (!veh) return v.placa || "—";

  const marca = veh.marca || "N/D";
  const modelo = veh.modelo || "";
  const placa = veh.placa ? `(${veh.placa})` : "";
  return `${marca} ${modelo} ${placa}`.trim() || "—";
}

function getPriorityFromIncident(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (["alta", "high", "critical", "critica", "crítica"].includes(p)) {
    return "Alta";
  }
  if (["media", "medium"].includes(p)) {
    return "Media";
  }
  return "Baja";
}

function getEstadoFromIncident(status) {
  const s = String(status || "").trim().toLowerCase();
  if (["abierto", "open"].includes(s)) return "Abierto";
  if (["en_proceso", "en proceso", "in_progress", "in progress"].includes(s)) {
    return "En Proceso";
  }
  if (["cerrado", "closed", "resuelto", "resolved"].includes(s)) {
    return "Resuelto";
  }
  return "Abierto";
}

function normalizePrioridad(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["alta", "high", "critical", "critica", "crítica"].includes(v)) {
    return "Alta";
  }
  if (["media", "medium"].includes(v)) {
    return "Media";
  }
  return "Baja";
}

function normalizeEstado(value, fallback = "Registrado") {
  const v = String(value || "").trim();
  return v || fallback;
}

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function nonEmptyString(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function normalizeActorRole(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim();

  if (Array.isArray(role)) {
    const first = role.find(Boolean);
    return normalizeActorRole(first);
  }

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    ).trim();
  }

  return String(role).trim();
}

async function bulkUpsertEvents(events = []) {
  if (!events.length) return;

  const ops = events.map((event) => ({
    updateOne: {
      filter: { eventKey: event.eventKey },
      update: {
        $set: {
          fecha: event.fecha,
          modulo: event.modulo,
          tipo: event.tipo,
          accion: event.accion || "SYNC",
          entidad: event.entidad || "",
          entidadId: event.entidadId || "",
          agente: event.agente || "Sistema",
          actorId: event.actorId || "",
          actorEmail: event.actorEmail || "",
          actorRol: event.actorRol || "",
          nombre: event.nombre || "",
          empresa: event.empresa || "",
          turno: event.turno || "Mañana",
          titulo: event.titulo || "",
          descripcion: event.descripcion || "",
          prioridad: event.prioridad || "Baja",
          estado: event.estado || "Registrado",
          source: event.source || "backend",
          ip: event.ip || "",
          userAgent: event.userAgent || "",
          before: event.before ?? null,
          after: event.after ?? null,
          meta: event.meta || {},
          visible: event.visible === false ? false : true,
        },
        $setOnInsert: {
          archived: false,
          archivedAt: null,
          archivedBy: "",
        },
      },
      upsert: true,
    },
  }));

  await BitacoraEvent.bulkWrite(ops, { ordered: false });
}

/* =========================================================
   Builders desde módulos reales
========================================================= */

async function buildAccesoManualEvents() {
  const items = await MovimientoManual.find({})
    .sort({ fechaHora: -1, createdAt: -1 })
    .lean();

  return items.map((m) => {
    const fecha = m.fechaHora || m.createdAt || new Date();
    const fechaDate = safeDate(fecha) || new Date();

    const tipoRaw = normalizeString(m.tipo);
    let estado = "Registrado";

    if (tipoRaw.toLowerCase() === "entrada") estado = "Entrada";
    if (tipoRaw.toLowerCase() === "salida") estado = "Salida";
    if (tipoRaw.toLowerCase() === "permiso") {
      estado = m.noRegresa ? "Permiso sin retorno" : "Permiso";
    }

    const detalleFin =
      tipoRaw.toLowerCase() === "permiso"
        ? m.noRegresa
          ? " No regresa."
          : m.fechaFin
          ? ` Regreso previsto: ${new Date(m.fechaFin).toLocaleString()}.`
          : ""
        : "";

    return {
      eventKey: buildEventKey("acceso-manual", m._id),
      fecha: fechaDate,
      modulo: "Control de Acceso",
      tipo: "Acceso",
      accion: "SYNC",
      entidad: "MovimientoManual",
      entidadId: String(m._id),
      titulo: `Acceso manual: ${tipoRaw || "Movimiento"}`,
      descripcion: `Movimiento manual tipo "${m.tipo || "N/D"}" de ${
        m.persona || "N/D"
      }. Placa: ${m.placa || "N/D"}. Departamento: ${
        m.departamento || "N/D"
      }. Observación: ${m.observacion || "Sin observación"}.${detalleFin}`,
      estado,
      prioridad: "Baja",
      turno: turnoFromDate(fechaDate),
      agente: m.persona || "Empleado",
      nombre: m.persona || "",
      empresa: "Interno",
      source: "acceso-manual",
      meta: {
        tipo: m.tipo || "",
        personaId: m.personaId || null,
        placa: m.placa || "",
        departamento: m.departamento || "",
        noRegresa: !!m.noRegresa,
        fechaFin: m.fechaFin || null,
        sourceCollection: "MovimientoManual",
        sourceId: String(m._id),
      },
    };
  });
}

async function buildAccesoVehiculoEvents() {
  const items = await MovimientoVehiculo.find({})
    .populate("vehiculo")
    .populate("empleado")
    .sort({ createdAt: -1 })
    .lean();

  return items.map((m) => {
    const fecha = m.createdAt || new Date();
    const fechaDate = safeDate(fecha) || new Date();

    const empleadoNombre =
      m.empleado?.nombreCompleto ||
      m.empleado?.nombre ||
      m.empleado?.name ||
      "Empleado";

    const vehiculoInfo = [
      m.vehiculo?.marca || "",
      m.vehiculo?.modelo || "",
      m.vehiculo?.placa ? `(${m.vehiculo.placa})` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const estado = m.estadoEnEmpresa ? "Dentro" : "Fuera";

    return {
      eventKey: buildEventKey("acceso-vehiculo", m._id),
      fecha: fechaDate,
      modulo: "Control de Acceso",
      tipo: "Acceso",
      accion: "SYNC",
      entidad: "MovimientoVehiculo",
      entidadId: String(m._id),
      titulo: `Vehículo ${m.estadoEnEmpresa ? "dentro" : "fuera"} de empresa`,
      descripcion: `Movimiento de vehículo de ${
        empleadoNombre || "N/D"
      }. Vehículo: ${vehiculoInfo || "N/D"}. Estado en empresa: ${
        m.estadoEnEmpresa ? "Sí" : "No"
      }. Observación: ${m.observacion || "Sin observación"}.`,
      estado,
      prioridad: "Baja",
      turno: turnoFromDate(fechaDate),
      agente: m.usuarioGuardia || empleadoNombre || "Guardia",
      nombre: empleadoNombre || "",
      empresa: "Interno",
      source: "acceso-vehiculo",
      meta: {
        vehiculoId: m.vehiculo?._id || null,
        empleadoId: m.empleado?._id || null,
        estadoEnEmpresa: !!m.estadoEnEmpresa,
        placa: m.vehiculo?.placa || "",
        observacion: m.observacion || "",
        sourceCollection: "MovimientoVehiculo",
        sourceId: String(m._id),
      },
    };
  });
}

async function buildVisitasEvents() {
  const items = await Visita.find({})
    .sort({ fechaEntrada: -1, citaAt: -1, createdAt: -1 })
    .lean();

  return items.map((v) => {
    const fecha = v.fechaEntrada || v.citaAt || v.createdAt || new Date();
    const fechaDate = safeDate(fecha) || new Date();

    let prioridad = "Baja";
    const estadoLower = String(v.estado || "").toLowerCase();
    if (estadoLower === "denegada" || estadoLower === "cancelada") {
      prioridad = "Media";
    }

    return {
      eventKey: buildEventKey("visita", v._id),
      fecha: fechaDate,
      modulo: "Control de Visitas",
      tipo: "Visita",
      accion: "SYNC",
      entidad: "Visita",
      entidadId: String(v._id),
      titulo: v.tipo === "Agendada" ? "Cita registrada" : "Visita registrada",
      descripcion:
        v.tipo === "Agendada"
          ? `Cita de ${v.nombre || "Visitante"} para ${
              v.empleado || "N/D"
            }. Motivo: ${v.motivo || "N/D"}. Estado: ${
              v.estado || "Programada"
            }. Empresa: ${v.empresa || "N/D"}. Vehículo: ${formatVehiculoVisita(
              v
            )}. Fecha programada: ${
              v.citaAt ? new Date(v.citaAt).toLocaleString() : "N/D"
            }.`
          : `Visita de ${v.nombre || "Visitante"} para ${
              v.empleado || "N/D"
            }. Motivo: ${v.motivo || "N/D"}. Estado: ${
              v.estado || "N/D"
            }. Empresa: ${v.empresa || "N/D"}. Vehículo: ${formatVehiculoVisita(
              v
            )}. Entrada: ${
              v.fechaEntrada ? new Date(v.fechaEntrada).toLocaleString() : "N/D"
            }${
              v.fechaSalida
                ? `, Salida: ${new Date(v.fechaSalida).toLocaleString()}`
                : ""
            }.`,
      estado: v.estado || (v.tipo === "Agendada" ? "Programada" : "Dentro"),
      prioridad,
      turno: turnoFromDate(fechaDate),
      agente: v.empleado || "Recepción",
      nombre: v.nombre || "",
      empresa: v.empresa || "",
      source: "visita",
      meta: {
        documento: v.documento || "",
        empleado: v.empleado || "",
        motivo: v.motivo || "",
        tipo: v.tipo || "",
        citaAt: v.citaAt || null,
        fechaEntrada: v.fechaEntrada || null,
        fechaSalida: v.fechaSalida || null,
        sourceCollection: "Visita",
        sourceId: String(v._id),
      },
    };
  });
}

async function buildRondasMarkEvents() {
  const items = await RqMark.find({})
    .sort({ at: -1, createdAt: -1 })
    .lean();

  return items.map((m) => {
    const fecha = m.at || m.createdAt || new Date();
    const fechaDate = safeDate(fecha) || new Date();

    const officer =
      m.officerName ||
      m.officerEmail ||
      m.guardName ||
      m.guardId ||
      "Guardia";

    const site = m.siteName || "Sitio sin nombre";
    const round = m.roundName || "Ronda sin nombre";
    const point = m.pointName || "Punto sin nombre";
    const qr = m.pointQr || "";
    const hardwareId = m.hardwareId || "";
    const steps = typeof m.steps === "number" ? m.steps : 0;
    const msg = m.message || "";

    const partes = [
      `Marcación de ronda en "${site}" / "${round}"`,
      `Punto: ${point}`,
    ];

    if (qr) partes.push(`QR: ${qr}`);
    if (hardwareId) partes.push(`Equipo: ${hardwareId}`);
    if (steps) partes.push(`Pasos: ${steps}`);
    if (msg) partes.push(`Mensaje: ${msg}`);

    return {
      eventKey: buildEventKey("rondas-mark", m._id),
      fecha: fechaDate,
      modulo: "Rondas de Vigilancia",
      tipo: "Ronda",
      accion: "SYNC",
      entidad: "RqMark",
      entidadId: String(m._id),
      titulo: "Marcación de ronda",
      descripcion: partes.join(" · "),
      estado: "Registrado",
      prioridad: "Baja",
      turno: turnoFromDate(fechaDate),
      agente: officer,
      nombre: officer,
      empresa: site,
      source: "rondas-mark",
      meta: {
        siteName: site,
        roundName: round,
        pointName: point,
        pointQr: qr,
        hardwareId,
        steps,
        message: msg,
        sourceCollection: "RqMark",
        sourceId: String(m._id),
      },
    };
  });
}

async function buildIncidentEvents() {
  const items = await IncidentGlobal.find({})
    .sort({ date: -1, createdAt: -1 })
    .lean();

  return items.map((i) => {
    const fecha = i.date || i.createdAt || new Date();
    const fechaDate = safeDate(fecha) || new Date();

    return {
      eventKey: buildEventKey("incidente", i._id),
      fecha: fechaDate,
      modulo: "Gestión de Incidentes",
      tipo: "Incidente",
      accion: "SYNC",
      entidad: "IncidentGlobal",
      entidadId: String(i._id),
      titulo: `Incidente: ${i.type || "Incidente"}`,
      descripcion: `Incidente tipo "${i.type || "Incidente"}". Zona: ${
        i.zone || "N/D"
      }. Detalle: ${i.description || "Sin descripción"}.`,
      estado: getEstadoFromIncident(i.status),
      prioridad: getPriorityFromIncident(i.priority),
      turno: turnoFromDate(fechaDate),
      agente: i.reportedBy || "Sistema",
      nombre: i.reportedBy || "",
      empresa: i.zone || "",
      source: "incidente",
      meta: {
        type: i.type || "",
        zone: i.zone || "",
        reportedBy: i.reportedBy || "",
        status: i.status || "",
        priority: i.priority || "",
        sourceCollection: "IncidentGlobal",
        sourceId: String(i._id),
      },
    };
  });
}

/* =========================================================
   Sync central
========================================================= */

export async function syncBitacoraFromSources() {
  const [accesoManual, accesoVehiculo, visitas, rondasMarks, incidentes] =
    await Promise.all([
      buildAccesoManualEvents(),
      buildAccesoVehiculoEvents(),
      buildVisitasEvents(),
      buildRondasMarkEvents(),
      buildIncidentEvents(),
    ]);

  const merged = [
    ...accesoManual,
    ...accesoVehiculo,
    ...visitas,
    ...rondasMarks,
    ...incidentes,
  ];

  await bulkUpsertEvents(merged);
  return merged.length;
}

/* =========================================================
   Log manual / programático
========================================================= */

export async function logBitacoraEvent(payload = {}) {
  const data = asObject(payload);

  const fecha =
    safeDate(data.fecha || data.createdAt || Date.now()) || new Date();
  const modulo = nonEmptyString(data.modulo, "General");
  const tipo = nonEmptyString(data.tipo, "Evento");
  const accion = nonEmptyString(data.accion, "CREAR");
  const entidad = nonEmptyString(data.entidad, "");
  const entidadId = nonEmptyString(data.entidadId, "");
  const titulo = nonEmptyString(data.titulo, `${tipo} registrado`);
  const descripcion = nonEmptyString(data.descripcion, "");
  const estado = normalizeEstado(data.estado, "Registrado");
  const prioridad = normalizePrioridad(data.prioridad);
  const turno = nonEmptyString(data.turno, turnoFromDate(fecha));
  const agente = nonEmptyString(
    data.agente || data.actor || data.usuario || data.user,
    "Sistema"
  );
  const nombre = nonEmptyString(
    data.nombre,
    agente === "Sistema" ? "" : agente
  );
  const empresa = nonEmptyString(data.empresa, "");
  const source = nonEmptyString(data.source, "manual");
  const ip = nonEmptyString(data.ip, "");
  const userAgent = nonEmptyString(data.userAgent, "");
  const actorId = nonEmptyString(data.actorId, "");
  const actorEmail = nonEmptyString(data.actorEmail, "");
  const actorRol = normalizeActorRole(data.actorRol);

  const meta = asObject(data.meta, {});
  const preferredEventKey = nonEmptyString(data.eventKey, "");
  const derivedEventKey =
    preferredEventKey ||
    (source && entidadId
      ? `${source}:${entidadId}`
      : `manual:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`);

  const update = {
    fecha,
    modulo,
    tipo,
    accion,
    entidad,
    entidadId,
    agente,
    actorId,
    actorEmail,
    actorRol,
    nombre,
    empresa,
    turno,
    titulo,
    descripcion,
    prioridad,
    estado,
    source,
    ip,
    userAgent,
    before: data.before ?? null,
    after: data.after ?? null,
    meta,
    visible: data.visible === false ? false : true,
  };

  if (data.archived === true) {
    update.archived = true;
    update.archivedAt = safeDate(data.archivedAt || Date.now()) || new Date();
    update.archivedBy = nonEmptyString(data.archivedBy, actorEmail || actorId);
    update.visible = false;
  } else if (data.archived === false) {
    update.archived = false;
    update.archivedAt = null;
    update.archivedBy = "";
    if (data.visible === undefined) {
      update.visible = true;
    }
  }

  const doc = await BitacoraEvent.findOneAndUpdate(
    { eventKey: derivedEventKey },
    {
      $set: update,
      $setOnInsert: {
        eventKey: derivedEventKey,
        archived: false,
        archivedAt: null,
        archivedBy: "",
      },
    },
    {
      new: true,
      upsert: true,
    }
  ).lean();

  return doc;
}

/* =========================================================
   API principal
========================================================= */

export async function getBitacoraEvents(filters = {}) {
  await syncBitacoraFromSources();

  const query = {
    visible: true,
    archived: { $ne: true },
  };

  if (filters.desde || filters.hasta) {
    query.fecha = {};
    if (filters.desde) {
      query.fecha.$gte = new Date(`${filters.desde}T00:00:00`);
    }
    if (filters.hasta) {
      query.fecha.$lte = new Date(`${filters.hasta}T23:59:59`);
    }
  }

  if (filters.agente) {
    query.$or = [
      { agente: { $regex: String(filters.agente), $options: "i" } },
      { nombre: { $regex: String(filters.agente), $options: "i" } },
      { actorEmail: { $regex: String(filters.agente), $options: "i" } },
    ];
  }

  if (filters.tipo && filters.tipo !== "Todos") query.tipo = filters.tipo;
  if (filters.modulo && filters.modulo !== "Todos") {
    query.modulo = filters.modulo;
  }
  if (filters.turno && filters.turno !== "Todos") query.turno = filters.turno;

  const items = await BitacoraEvent.find(query)
    .sort({ fecha: -1, createdAt: -1 })
    .lean();

  return items;
}

/* =========================================================
   Detalle
========================================================= */

export async function getBitacoraEventById(bitacoraId) {
  if (!bitacoraId) {
    const err = new Error("ID requerido");
    err.status = 400;
    throw err;
  }

  const item = await BitacoraEvent.findById(bitacoraId).lean();

  if (!item) {
    const err = new Error("Evento de bitácora no encontrado");
    err.status = 404;
    throw err;
  }

  return item;
}

/* =========================================================
   Archive profesional
========================================================= */

export async function archiveBitacoraEvent(bitacoraId, actor = "") {
  if (!bitacoraId) {
    const err = new Error("ID requerido");
    err.status = 400;
    throw err;
  }

  const updated = await BitacoraEvent.findByIdAndUpdate(
    bitacoraId,
    {
      $set: {
        visible: false,
        archived: true,
        archivedAt: new Date(),
        archivedBy: String(actor || "").trim(),
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    const err = new Error("Evento de bitácora no encontrado");
    err.status = 404;
    throw err;
  }

  return updated;
}

export async function restoreBitacoraEvent(bitacoraId) {
  if (!bitacoraId) {
    const err = new Error("ID requerido");
    err.status = 400;
    throw err;
  }

  const updated = await BitacoraEvent.findByIdAndUpdate(
    bitacoraId,
    {
      $set: {
        visible: true,
        archived: false,
        archivedAt: null,
        archivedBy: "",
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    const err = new Error("Evento de bitácora no encontrado");
    err.status = 404;
    throw err;
  }

  return updated;
}