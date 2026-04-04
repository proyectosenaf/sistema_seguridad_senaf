import crypto from "crypto";
import QRCode from "qrcode";
import Visita from "./visitas.model.js";
import VisitFeedback from "./models/VisitFeedback.js";
import { logBitacoraEvent } from "../bitacora/services/bitacora.service.js";

const QR_PREFIX = "SENAF_CITA_QR::";
const DEFAULT_TIMEZONE = "America/Tegucigalpa";

/* ───────────────────────── Helpers ───────────────────────── */

function hasVehicleData(vehiculo) {
  if (!vehiculo || typeof vehiculo !== "object") return false;

  return !!(
    (vehiculo.placa && String(vehiculo.placa).trim() !== "") ||
    (vehiculo.marca && String(vehiculo.marca).trim() !== "") ||
    (vehiculo.modelo && String(vehiculo.modelo).trim() !== "")
  );
}

function normalizeVehiculoInput(vehiculo) {
  if (!hasVehicleData(vehiculo)) return null;

  return {
    marca: String(vehiculo?.marca || "").trim(),
    modelo: String(vehiculo?.modelo || "").trim(),
    placa: String(vehiculo?.placa || "").trim().toUpperCase(),
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanDoc(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;

  const raw = String(value || "").trim().toLowerCase();
  return ["true", "1", "si", "sí", "yes", "on"].includes(raw);
}

function normalizeAcompanantesInput(acompanantes) {
  if (!Array.isArray(acompanantes)) return [];

  return acompanantes
    .map((item) => ({
      nombre: cleanText(item?.nombre),
      documento: cleanText(item?.documento),
    }))
    .filter((item) => item.nombre && item.documento);
}

function hasAcompanantesData(acompanantes) {
  return Array.isArray(acompanantes) && acompanantes.length > 0;
}

function buildDayRange(day) {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return null;

  const start = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0,
    0,
    0,
    0
  );

  const end = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + 1,
    0,
    0,
    0,
    0
  );

  return { start, end };
}

function buildMonthRange(month) {
  if (!month || typeof month !== "string") return null;

  const parts = month.split("-");
  if (parts.length !== 2) return null;

  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);

  if (Number.isNaN(yyyy) || Number.isNaN(mm) || mm < 1 || mm > 12) {
    return null;
  }

  const start = new Date(yyyy, mm - 1, 1, 0, 0, 0, 0);
  const end = new Date(yyyy, mm, 1, 0, 0, 0, 0);

  return { start, end };
}

function getActorId(req) {
  return req?.user?._id || req?.user?.id || req?.user?.sub || null;
}

function getActorEmail(req) {
  return (
    req?.user?.email ||
    req?.user?.correo ||
    req?.user?.user?.email ||
    req?.user?.user?.correo ||
    ""
  );
}

function getActorName(req) {
  return (
    req?.user?.name ||
    req?.user?.nombre ||
    req?.user?.fullName ||
    req?.user?.email ||
    req?.user?.user?.name ||
    req?.user?.user?.nombre ||
    req?.user?.user?.fullName ||
    req?.user?.user?.email ||
    "Sistema de Visitas"
  );
}

function toPlain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") return doc.toObject();
  return JSON.parse(JSON.stringify(doc));
}

function normalizeEstadoInput(estado) {
  const raw = String(estado || "").trim().toLowerCase();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw] || estado;
}

function canEnterByEstado(estado) {
  return ["Programada", "En revisión", "Autorizada"].includes(estado);
}

function buildVisitaDescripcion(visita, prefix = "Visita") {
  const acompanantesTxt =
    Array.isArray(visita.acompanantes) && visita.acompanantes.length > 0
      ? ` Acompañantes: ${visita.acompanantes.length}.`
      : "";

  return `${prefix} de ${visita.nombre || "Visitante"} para ${
    visita.empleado || "N/D"
  }. Motivo: ${visita.motivo || "N/D"}. Estado: ${
    visita.estado || "Registrado"
  }. Empresa: ${visita.empresa || "N/D"}.${acompanantesTxt}`;
}

async function auditVisita(req, payload = {}) {
  await logBitacoraEvent({
    modulo: "Control de Visitas",
    tipo: "Visita",
    accion: payload.accion || "CREAR",
    entidad: payload.entidad || "Visita",
    entidadId: payload.entidadId || "",
    agente: payload.agente || getActorName(req),
    actorId: payload.actorId || getActorId(req) || "",
    actorEmail: payload.actorEmail || getActorEmail(req),
    titulo: payload.titulo || "",
    descripcion: payload.descripcion || "",
    prioridad: payload.prioridad || "Baja",
    estado: payload.estado || "Registrado",
    nombre: payload.nombre || "",
    empresa: payload.empresa || "",
    source: payload.source || "visitas",
    ip: req.ip || "",
    userAgent: req.get("user-agent") || "",
    before: payload.before || null,
    after: payload.after || null,
    meta: payload.meta || {},
  });
}

function buildCommonPayload(body = {}) {
  const {
    nombre,
    documento,
    empresa,
    empleado,
    motivo,
    telefono,
    correo,
    llegoEnVehiculo,
    vehiculo,
    acompanado,
    acompanantes,
  } = body;

  const normalizedVehiculo = normalizeVehiculoInput(vehiculo);
  const hasVehiculo = !!normalizedVehiculo;

  const normalizedAcompanantes = normalizeAcompanantesInput(acompanantes);
  const hasAcompanantes = hasAcompanantesData(normalizedAcompanantes);

  const finalAcompanado =
    typeof acompanado !== "undefined"
      ? normalizeBoolean(acompanado)
      : hasAcompanantes;

  return {
    nombre,
    documento,
    empresa: empresa || null,
    empleado: empleado || null,
    motivo,
    telefono: telefono || null,
    correo: correo || null,
    llegoEnVehiculo:
      typeof llegoEnVehiculo !== "undefined"
        ? !!llegoEnVehiculo
        : hasVehiculo,
    vehiculo:
      typeof llegoEnVehiculo !== "undefined"
        ? !!llegoEnVehiculo
          ? normalizedVehiculo
          : null
        : normalizedVehiculo,
    acompanado: finalAcompanado,
    acompanantes: finalAcompanado ? normalizedAcompanantes : [],
  };
}

/* ───────────────────────── Helpers ownership ───────────────────────── */

function normalizeRoleName(role) {
  if (!role) return "";

  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        role.rol ||
        role.role ||
        role.tipo ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function extractRoleNames(user) {
  if (!user || typeof user !== "object") return [];

  const candidates = [
    user.role,
    user.rol,
    user.userRole,
    user.tipo,
    user.roles,
    user.authorities,
    user.perfiles,
    user.profile,
    user.perfil,
    user.user?.role,
    user.user?.rol,
    user.user?.userRole,
    user.user?.tipo,
    user.user?.roles,
  ];

  const list = [];

  for (const item of candidates) {
    if (Array.isArray(item)) {
      item.forEach((x) => {
        const r = normalizeRoleName(x);
        if (r) list.push(r);
      });
      continue;
    }

    const r = normalizeRoleName(item);
    if (r) list.push(r);
  }

  return Array.from(new Set(list));
}

function isVisitanteUser(user) {
  const roles = extractRoleNames(user);
  return roles.some((r) =>
    ["visita", "visitante", "visitor", "visitors"].includes(r)
  );
}

function getUserDocumento(user) {
  return cleanDoc(
    user?.documento ||
      user?.dni ||
      user?.identityNumber ||
      user?.numeroDocumento ||
      user?.doc ||
      user?.user?.documento ||
      user?.user?.dni ||
      user?.user?.identityNumber ||
      user?.user?.numeroDocumento ||
      user?.user?.doc ||
      ""
  );
}

function getUserEmail(user) {
  return String(
    user?.email ||
      user?.correo ||
      user?.mail ||
      user?.user?.email ||
      user?.user?.correo ||
      user?.user?.mail ||
      ""
  )
    .trim()
    .toLowerCase();
}

function isOwnCita(user, visita) {
  if (!user || !visita) return false;

  const userDoc = getUserDocumento(user);
  const visitaDoc = cleanDoc(visita?.documento || "");

  if (userDoc && visitaDoc && userDoc === visitaDoc) {
    return true;
  }

  const userEmail = getUserEmail(user);
  const visitaEmail = String(visita?.correo || "")
    .trim()
    .toLowerCase();

  if (userEmail && visitaEmail && userEmail === visitaEmail) {
    return true;
  }

  return false;
}

function buildOwnCitasMatch(req) {
  const user = req?.user || null;
  const documento = getUserDocumento(user);
  const email = getUserEmail(user);

  const or = [];

  if (documento) {
    or.push({ documento: new RegExp(`^${documento}$`, "i") });
  }

  if (email) {
    or.push({ correo: new RegExp(`^${email}$`, "i") });
  }

  return or.length ? { $or: or } : null;
}

/* ───────────────────────── Helpers QR / fecha ───────────────────────── */

function normalizeQrRaw(raw) {
  return String(raw || "").trim();
}

function getClientTimeZone(req) {
  const value =
    req?.body?.clientTimeZone ||
    req?.headers?.["x-client-timezone"] ||
    DEFAULT_TIMEZONE;

  return String(value || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
}

function formatYmdInTimeZone(dateInput, timeZone = DEFAULT_TIMEZONE) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const day = parts.find((p) => p.type === "day")?.value || "";

    if (!year || !month || !day) return "";
    return `${year}-${month}-${day}`;
  } catch {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

function getTodayYmdFromRequest(req, timeZone = DEFAULT_TIMEZONE) {
  const clientDate = String(req?.body?.clientDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clientDate)) return clientDate;

  const clientNowIso = String(req?.body?.clientNowIso || "").trim();
  if (clientNowIso) {
    const dt = new Date(clientNowIso);
    if (!Number.isNaN(dt.getTime())) {
      const ymd = formatYmdInTimeZone(dt, timeZone);
      if (ymd) return ymd;
    }
  }

  return formatYmdInTimeZone(new Date(), timeZone);
}

function isCitaForToday(citaAt, todayYmd, timeZone = DEFAULT_TIMEZONE) {
  if (!citaAt || !todayYmd) return false;
  const citaYmd = formatYmdInTimeZone(citaAt, timeZone);
  return !!citaYmd && citaYmd === todayYmd;
}

function setCheckinFields(visita, req, now = new Date(), method = "manual") {
  const actorId = getActorId(req);
  const actorName = getActorName(req);

  visita.estado = "Dentro";

  if (!visita.fechaEntrada) {
    visita.fechaEntrada = now;
  }

  if (!visita.validatedAt) {
    visita.validatedAt = now;
  }

  if (!visita.ingresadaAt) {
    visita.ingresadaAt = now;
  }

  if (actorId && !visita.validatedBy) {
    visita.validatedBy = actorId;
  }

  if (actorId && !visita.ingresadaBy) {
    visita.ingresadaBy = actorId;
  }

  visita.checkedInMethod = method;
  visita.checkedInByName = actorName;
}

function buildScanQrResponseItem(visita, extra = {}) {
  const item = toPlain(visita) || {};
  return {
    ...item,
    ...extra,
    checkinOk: item.estado === "Dentro",
    ingresoRegistrado: item.estado === "Dentro",
    checkedInMethod: item.checkedInMethod || extra.checkedInMethod || "qr",
    checkedInByName: item.checkedInByName || extra.checkedInByName || "",
  };
}

async function buildQrDataUrl(qrPayload) {
  if (!qrPayload) return null;

  return QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function clearQrFields(visita) {
  visita.qrToken = null;
  visita.qrPayload = null;
  visita.qrGeneratedAt = null;
  visita.autorizadaAt = null;
}

function shouldInvalidateQrOnUpdate(visita, payload = {}, nextCitaAt) {
  if (!visita?.qrToken) return false;

  const currentCitaAtIso = visita?.citaAt
    ? new Date(visita.citaAt).toISOString()
    : null;
  const nextCitaAtIso = nextCitaAt ? new Date(nextCitaAt).toISOString() : null;

  if (currentCitaAtIso !== nextCitaAtIso) return true;
  if (cleanText(visita?.empleado || "") !== cleanText(payload?.empleado || "")) {
    return true;
  }

  return false;
}

/* ───────────────────────── Helpers feedback ───────────────────────── */

function isVisitFinished(visita) {
  const estado = normalizeEstadoInput(visita?.estado || "");
  return estado === "Finalizada";
}

function canVisitorAnswerFeedback(user, visita) {
  if (!user || !visita) return false;
  return isOwnCita(user, visita);
}

function normalizeRecommendValue(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["yes", "maybe", "no"].includes(raw) ? raw : "";
}

async function auditFeedback(req, visita, feedback, extra = {}) {
  await auditVisita(req, {
    accion: "FEEDBACK",
    entidad: "Visita",
    entidadId: visita?._id?.toString() || "",
    titulo: "Feedback de visita registrado",
    descripcion: `Se registró una calificación de ${feedback?.rating || "N/D"} estrella(s) para la visita de ${visita?.nombre || "Visitante"}.`,
    estado: visita?.estado || "Finalizada",
    nombre: visita?.nombre || "",
    empresa: visita?.empresa || "",
    source: "visitas-feedback",
    meta: {
      visitaId: visita?._id?.toString() || "",
      rating: feedback?.rating || null,
      wouldRecommend: feedback?.wouldRecommend || "",
      hasComment: !!cleanText(feedback?.comment || ""),
      ...extra,
    },
  });
}

/**
 * GET /api/visitas
 */
export async function getVisitas(req, res) {
  try {
    const visitas = await Visita.find({})
      .sort({ fechaEntrada: -1, createdAt: -1 })
      .lean();

    return res.json({ ok: true, items: visitas });
  } catch (err) {
    console.error("[visitas] getVisitas", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/visitas
 */
export async function createVisita(req, res) {
  try {
    const { tipo, citaAt } = req.body || {};

    const payload = buildCommonPayload(req.body || {});

    const visita = new Visita({
      ...payload,
      tipo: tipo || "Ingreso",
      citaAt: citaAt || null,
    });

    await visita.save();

    await auditVisita(req, {
      accion: "CREAR",
      entidad: "Visita",
      entidadId: visita._id?.toString(),
      titulo: "Visita registrada",
      descripcion: buildVisitaDescripcion(visita, "Visita"),
      estado: visita.estado || "Registrado",
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "visitas",
      after: toPlain(visita),
      meta: {
        documento: visita.documento || "",
        empleado: visita.empleado || "",
        motivo: visita.motivo || "",
        tipo: visita.tipo || "Ingreso",
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
        acompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes
          : [],
      },
    });

    return res.status(201).json({
      ok: true,
      item: visita,
    });
  } catch (err) {
    console.error("[visitas] createVisita", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/visitas/:id/cerrar
 */
export async function closeVisita(req, res) {
  try {
    const { id } = req.params;

    const visita = await Visita.findById(id);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Visita no encontrada",
      });
    }

    const before = toPlain(visita);

    if (!visita.fechaSalida) {
      visita.fechaSalida = new Date();
    }

    visita.estado = "Finalizada";
    visita.feedbackEnabled = true;
    if (!visita.feedbackRequestedAt) {
      visita.feedbackRequestedAt = new Date();
    }

    await visita.save();

    await auditVisita(req, {
      accion: "CERRAR",
      entidad: "Visita",
      entidadId: visita._id?.toString(),
      titulo: "Visita finalizada",
      descripcion: `Se finalizó la visita de ${visita.nombre || "Visitante"}.`,
      estado: "Finalizada",
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "visitas",
      before,
      after: toPlain(visita),
      meta: {
        documento: visita.documento || "",
        fechaSalida: visita.fechaSalida || null,
        feedbackEnabled: !!visita.feedbackEnabled,
        feedbackRequestedAt: visita.feedbackRequestedAt || null,
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
      },
    });

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] closeVisita", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/citas
 */
export async function createCita(req, res) {
  try {
    const { citaAt } = req.body || {};

    const payload = buildCommonPayload(req.body || {});
    const visitante = isVisitanteUser(req.user);

    const citaDate = citaAt ? new Date(citaAt) : null;
    if (!citaDate || Number.isNaN(citaDate.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Debe indicar una fecha/hora de cita válida",
      });
    }

    if (visitante) {
      const userDoc = getUserDocumento(req.user);
      const userEmail = getUserEmail(req.user);

      if (userDoc) {
        payload.documento = userDoc;
      }

      if (userEmail) {
        payload.correo = userEmail;
      }

      if (!isOwnCita(req.user, payload)) {
        return res.status(403).json({
          ok: false,
          error: "Solo puede crear citas con su propio documento o correo",
        });
      }
    }

    const visita = new Visita({
      ...payload,
      tipo: "Agendada",
      estado: "Programada",
      citaAt: citaDate,
      qrToken: null,
      qrPayload: null,
      qrGeneratedAt: null,
      autorizadaAt: null,
      feedbackEnabled: false,
      feedbackSubmitted: false,
      feedbackScore: null,
      feedbackRequestedAt: null,
      feedbackSubmittedAt: null,
    });

    await visita.save();

    await auditVisita(req, {
      accion: "CREAR",
      entidad: "Cita",
      entidadId: visita._id?.toString(),
      titulo: "Cita creada",
      descripcion: `Cita programada para ${visita.nombre || "Visitante"} con ${
        visita.empleado || "N/D"
      } el ${
        visita.citaAt ? new Date(visita.citaAt).toLocaleString() : "N/D"
      }.`,
      estado: visita.estado || "Programada",
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "citas",
      after: toPlain(visita),
      meta: {
        documento: visita.documento || "",
        motivo: visita.motivo || "",
        citaAt: visita.citaAt || null,
        qrToken: null,
        creadaPorVisitante: visitante,
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
        acompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes
          : [],
      },
    });

    const item = visita.toObject ? visita.toObject() : visita;
    item.qrDataUrl = null;
    item.qrPayload = null;
    item.qrToken = null;
    item.qrMessage =
      "Una vez autorizada esta agenda, se generará el código QR.";

    return res.status(201).json({
      ok: true,
      item,
      qrDataUrl: null,
      qrPayload: null,
      qrToken: null,
      message:
        "Una vez autorizada esta agenda, se generará el código QR.",
    });
  } catch (err) {
    console.error("[visitas] createCita", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/citas/:id
 * Editar cita
 */
export async function updateCita(req, res) {
  try {
    const { id } = req.params;
    const { citaAt, estado } = req.body || {};
    const visitante = isVisitanteUser(req.user);

    const visita = await Visita.findById(id);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Cita/visita no encontrada",
      });
    }

    if (visita.tipo !== "Agendada") {
      return res.status(400).json({
        ok: false,
        error: "El registro indicado no corresponde a una cita agendada",
      });
    }

    if (visitante && !isOwnCita(req.user, visita)) {
      return res.status(403).json({
        ok: false,
        error: "Solo puede editar sus propias citas",
      });
    }

    const before = toPlain(visita);
    const payload = buildCommonPayload(req.body || {});

    if (visitante) {
      const userDoc = getUserDocumento(req.user);
      const userEmail = getUserEmail(req.user);

      if (userDoc) {
        payload.documento = userDoc;
      }

      if (userEmail) {
        payload.correo = userEmail;
      }
    }

    let nextCitaDate = visita.citaAt ? new Date(visita.citaAt) : null;

    if (typeof citaAt !== "undefined") {
      nextCitaDate = citaAt ? new Date(citaAt) : null;
      if (!nextCitaDate || Number.isNaN(nextCitaDate.getTime())) {
        return res.status(400).json({
          ok: false,
          error: "Debe indicar una fecha/hora de cita válida",
        });
      }
    }

    const invalidateQr = shouldInvalidateQrOnUpdate(
      visita,
      payload,
      nextCitaDate
    );

    visita.nombre = payload.nombre;
    visita.documento = payload.documento;
    visita.empresa = payload.empresa;
    visita.empleado = payload.empleado;
    visita.motivo = payload.motivo;
    visita.telefono = payload.telefono;
    visita.correo = payload.correo;
    visita.llegoEnVehiculo = payload.llegoEnVehiculo;
    visita.vehiculo = payload.vehiculo;
    visita.acompanado = payload.acompanado;
    visita.acompanantes = payload.acompanantes;

    if (typeof citaAt !== "undefined") {
      visita.citaAt = nextCitaDate;
    }

    if (invalidateQr) {
      clearQrFields(visita);
      visita.estado = "Programada";
    } else if (!visitante && typeof estado !== "undefined" && estado !== "") {
      visita.estado = normalizeEstadoInput(estado);
    }

    await visita.save();

    const item = visita.toObject ? visita.toObject() : visita;
    let qrDataUrl = null;

    if (item.estado === "Autorizada" && item.qrPayload) {
      qrDataUrl = await buildQrDataUrl(item.qrPayload);
      item.qrDataUrl = qrDataUrl;
    } else {
      item.qrDataUrl = null;
      item.qrMessage =
        "Una vez autorizada esta agenda, se generará el código QR.";
    }

    await auditVisita(req, {
      accion: "ACTUALIZAR",
      entidad: "Cita",
      entidadId: visita._id?.toString(),
      titulo: "Cita actualizada",
      descripcion: `Se actualizó la cita de ${visita.nombre || "Visitante"}.`,
      estado: visita.estado || "Programada",
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "citas",
      before,
      after: toPlain(visita),
      meta: {
        documento: visita.documento || "",
        empleado: visita.empleado || "",
        motivo: visita.motivo || "",
        citaAt: visita.citaAt || null,
        editadaPorVisitante: visitante,
        qrInvalidado: invalidateQr,
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
        acompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes
          : [],
      },
    });

    return res.json({
      ok: true,
      item,
      qrDataUrl,
      qrPayload: item.qrPayload || null,
      qrToken: item.qrToken || null,
      message:
        item.estado === "Autorizada" && item.qrPayload
          ? "Cita actualizada correctamente"
          : "Una vez autorizada esta agenda, se generará el código QR.",
    });
  } catch (err) {
    console.error("[visitas] updateCita", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/citas
 */
export async function listCitas(req, res) {
  try {
    const { day, month, estado, q } = req.query || {};
    const visitante = isVisitanteUser(req.user);

    const match = { tipo: "Agendada" };

    if (day) {
      const range = buildDayRange(day);
      if (!range) {
        return res.status(400).json({
          ok: false,
          error: "Parámetro day inválido. Use YYYY-MM-DD",
        });
      }
      match.citaAt = { $gte: range.start, $lt: range.end };
    } else if (month) {
      const range = buildMonthRange(month);
      if (!range) {
        return res.status(400).json({
          ok: false,
          error: "Parámetro month inválido. Use YYYY-MM",
        });
      }
      match.citaAt = { $gte: range.start, $lt: range.end };
    }

    if (estado) {
      match.estado = normalizeEstadoInput(estado);
    }

    if (q && String(q).trim() !== "") {
      const rx = new RegExp(String(q).trim(), "i");
      match.$or = [
        { nombre: rx },
        { documento: rx },
        { empresa: rx },
        { empleado: rx },
        { motivo: rx },
        { "acompanantes.nombre": rx },
        { "acompanantes.documento": rx },
      ];
    }

    if (visitante) {
      const ownMatch = buildOwnCitasMatch(req);

      if (!ownMatch) {
        return res.json({ ok: true, items: [] });
      }

      if (match.$or) {
        match.$and = [{ $or: match.$or }, ownMatch];
        delete match.$or;
      } else {
        Object.assign(match, ownMatch);
      }
    }

    const citas = await Visita.find(match)
      .sort({ citaAt: 1, createdAt: -1 })
      .lean();

    return res.json({ ok: true, items: citas });
  } catch (err) {
    console.error("[visitas] listCitas", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/citas/:id/checkin
 */
export async function checkinCita(req, res) {
  try {
    const { id } = req.params;

    const visita = await Visita.findById(id);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Cita/visita no encontrada",
      });
    }

    if (visita.tipo !== "Agendada") {
      return res.status(400).json({
        ok: false,
        error: "El registro indicado no corresponde a una cita agendada",
      });
    }

    const estadoActual = normalizeEstadoInput(visita.estado);

    if (estadoActual === "Dentro") {
      return res.json({
        ok: true,
        item: buildScanQrResponseItem(visita, {
          checkedInMethod: visita.checkedInMethod || "manual",
          checkedInByName: visita.checkedInByName || getActorName(req),
        }),
        message: "La cita ya estaba registrada como dentro",
      });
    }

    if (estadoActual === "Finalizada") {
      return res.status(409).json({
        ok: false,
        error: "La visita ya fue finalizada",
      });
    }

    if (estadoActual === "Cancelada" || estadoActual === "Denegada") {
      return res.status(409).json({
        ok: false,
        error: `No se puede registrar ingreso porque la cita está en estado "${estadoActual}"`,
      });
    }

    if (!canEnterByEstado(estadoActual)) {
      return res.status(409).json({
        ok: false,
        error: `La cita no puede ingresar desde el estado "${estadoActual}"`,
      });
    }

    if (!visita.citaAt || Number.isNaN(new Date(visita.citaAt).getTime())) {
      return res.status(409).json({
        ok: false,
        error: "La cita no tiene una fecha válida",
      });
    }

    const timeZone = getClientTimeZone(req);
    const todayYmd = getTodayYmdFromRequest(req, timeZone);

    if (!isCitaForToday(visita.citaAt, todayYmd, timeZone)) {
      return res.status(409).json({
        ok: false,
        error: "El QR o la cita no corresponden al día actual",
        item: buildScanQrResponseItem(visita, {
          validForToday: false,
          citaDateLocal: formatYmdInTimeZone(visita.citaAt, timeZone),
          todayLocal: todayYmd,
        }),
      });
    }

    const before = toPlain(visita);
    const now = new Date();

    setCheckinFields(visita, req, now, "manual");

    await visita.save();

    await auditVisita(req, {
      accion: "CHECKIN",
      entidad: "Cita",
      entidadId: visita._id?.toString(),
      titulo: "Check-in de cita",
      descripcion: `Ingreso registrado para ${visita.nombre || "Visitante"}.`,
      estado: visita.estado || "Dentro",
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "citas",
      before,
      after: toPlain(visita),
      meta: {
        documento: visita.documento || "",
        fechaEntrada: visita.fechaEntrada || null,
        checkedInMethod: visita.checkedInMethod || "manual",
        checkedInByName: visita.checkedInByName || getActorName(req),
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
      },
    });

    return res.json({
      ok: true,
      item: buildScanQrResponseItem(visita, {
        validForToday: true,
        todayLocal: todayYmd,
        citaDateLocal: formatYmdInTimeZone(visita.citaAt, timeZone),
      }),
      message: "Ingreso registrado correctamente",
    });
  } catch (err) {
    console.error("[visitas] checkinCita", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/citas/:id/estado
 */
export async function updateCitaEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({
        ok: false,
        error: "Debe indicar un estado",
      });
    }

    const visita = await Visita.findById(id);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Cita/visita no encontrada",
      });
    }

    const before = toPlain(visita);
    const nextEstado = normalizeEstadoInput(estado);

    visita.estado = nextEstado;

    if (nextEstado === "Autorizada") {
      if (!visita.qrToken) {
        const qrToken = crypto.randomUUID();
        const qrPayload = `${QR_PREFIX}${qrToken}`;

        visita.qrToken = qrToken;
        visita.qrPayload = qrPayload;
        visita.qrGeneratedAt = new Date();
      }

      if (!visita.autorizadaAt) {
        visita.autorizadaAt = new Date();
      }
    } else {
      clearQrFields(visita);
    }

    if (nextEstado === "Dentro" && !visita.fechaEntrada) {
      visita.fechaEntrada = new Date();
    }

    if (nextEstado === "Finalizada" && !visita.fechaSalida) {
      visita.fechaSalida = new Date();
    }

    if (nextEstado === "Finalizada") {
      visita.feedbackEnabled = true;
      if (!visita.feedbackRequestedAt) {
        visita.feedbackRequestedAt = new Date();
      }
    }

    await visita.save();

    const item = visita.toObject ? visita.toObject() : visita;
    let qrDataUrl = null;

    if (item.estado === "Autorizada" && item.qrPayload) {
      qrDataUrl = await buildQrDataUrl(item.qrPayload);
      item.qrDataUrl = qrDataUrl;
    } else {
      item.qrDataUrl = null;
      item.qrMessage =
        "Una vez autorizada esta agenda, se generará el código QR.";
    }

    await auditVisita(req, {
      accion: "ACTUALIZAR",
      entidad: "Cita",
      entidadId: visita._id?.toString(),
      titulo: "Estado de cita actualizado",
      descripcion: `La cita de ${visita.nombre || "Visitante"} cambió a estado "${nextEstado}".`,
      estado: nextEstado,
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "citas",
      before,
      after: toPlain(visita),
      meta: {
        documento: visita.documento || "",
        estado: nextEstado,
        qrToken: visita.qrToken || null,
        qrGeneratedAt: visita.qrGeneratedAt || null,
        feedbackEnabled: !!visita.feedbackEnabled,
        feedbackRequestedAt: visita.feedbackRequestedAt || null,
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
      },
    });

    return res.json({
      ok: true,
      item,
      qrDataUrl,
      qrPayload: item.qrPayload || null,
      qrToken: item.qrToken || null,
      message:
        item.estado === "Autorizada" && item.qrPayload
          ? "Cita autorizada y código QR generado correctamente"
          : "Una vez autorizada esta agenda, se generará el código QR.",
    });
  } catch (err) {
    console.error("[visitas] updateCitaEstado", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/citas/scan-qr
 */
export async function scanQrCita(req, res) {
  try {
    const { qrText, qrPayload, source } = req.body || {};
    const raw = normalizeQrRaw(qrText || qrPayload);

    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar qrText o qrPayload",
      });
    }

    if (!raw.startsWith(QR_PREFIX)) {
      return res.status(400).json({
        ok: false,
        error: "Formato de QR no válido",
      });
    }

    const qrToken = raw.slice(QR_PREFIX.length).trim();
    if (!qrToken) {
      return res.status(400).json({
        ok: false,
        error: "QR inválido",
      });
    }

    const visita = await Visita.findOne({ qrToken });
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró una cita asociada a este QR",
      });
    }

    if (visita.tipo !== "Agendada") {
      return res.status(409).json({
        ok: false,
        error: "El QR pertenece a un registro que no es una cita agendada",
        item: buildScanQrResponseItem(visita),
      });
    }

    if (normalizeEstadoInput(visita.estado) !== "Autorizada") {
      return res.status(409).json({
        ok: false,
        error: "La cita no está autorizada para usar QR",
        item: buildScanQrResponseItem(visita),
      });
    }

    if (!visita.citaAt || Number.isNaN(new Date(visita.citaAt).getTime())) {
      return res.status(409).json({
        ok: false,
        error: "La cita asociada al QR no tiene una fecha válida",
        item: buildScanQrResponseItem(visita),
      });
    }

    const timeZone = getClientTimeZone(req);
    const todayYmd = getTodayYmdFromRequest(req, timeZone);
    const citaDateLocal = formatYmdInTimeZone(visita.citaAt, timeZone);

    if (!isCitaForToday(visita.citaAt, todayYmd, timeZone)) {
      return res.status(409).json({
        ok: false,
        error: "Este QR solo tiene validez para el día de la cita",
        item: buildScanQrResponseItem(visita, {
          validForToday: false,
          todayLocal: todayYmd,
          citaDateLocal,
          checkedInMethod: visita.checkedInMethod || "qr",
          checkedInByName: visita.checkedInByName || "",
        }),
      });
    }

    const estadoActual = normalizeEstadoInput(visita.estado);

    if (estadoActual === "Finalizada") {
      return res.status(409).json({
        ok: false,
        error: "La visita ya fue finalizada",
        item: buildScanQrResponseItem(visita, {
          validForToday: true,
          todayLocal: todayYmd,
          citaDateLocal,
        }),
      });
    }

    if (estadoActual === "Cancelada" || estadoActual === "Denegada") {
      return res.status(409).json({
        ok: false,
        error: `La cita no puede ingresar porque está en estado "${estadoActual}"`,
        item: buildScanQrResponseItem(visita, {
          validForToday: true,
          todayLocal: todayYmd,
          citaDateLocal,
        }),
      });
    }

    if (estadoActual === "Dentro") {
      return res.status(409).json({
        ok: false,
        error: "La cita ya fue registrada previamente como dentro",
        item: buildScanQrResponseItem(visita, {
          validForToday: true,
          todayLocal: todayYmd,
          citaDateLocal,
          checkedInMethod: visita.checkedInMethod || "qr",
          checkedInByName: visita.checkedInByName || "",
        }),
      });
    }

    if (!canEnterByEstado(estadoActual)) {
      return res.status(409).json({
        ok: false,
        error: `La cita no puede ingresar desde el estado "${estadoActual}"`,
        item: buildScanQrResponseItem(visita, {
          validForToday: true,
          todayLocal: todayYmd,
          citaDateLocal,
        }),
      });
    }

    const before = toPlain(visita);
    const now = new Date();

    setCheckinFields(visita, req, now, source === "manual" ? "manual" : "qr");

    await visita.save();

    await auditVisita(req, {
      accion: "SCAN_QR",
      entidad: "Cita",
      entidadId: visita._id?.toString(),
      titulo: "Ingreso por QR",
      descripcion: `Ingreso por QR registrado para ${visita.nombre || "Visitante"}.`,
      estado: visita.estado || "Dentro",
      nombre: visita.nombre || "",
      empresa: visita.empresa || "",
      source: "citas-qr",
      before,
      after: toPlain(visita),
      meta: {
        qrToken,
        documento: visita.documento || "",
        fechaEntrada: visita.fechaEntrada || null,
        validForToday: true,
        todayLocal: todayYmd,
        citaDateLocal,
        checkedInMethod: visita.checkedInMethod || "qr",
        checkedInByName: visita.checkedInByName || getActorName(req),
        acompanado: !!visita.acompanado,
        cantidadAcompanantes: Array.isArray(visita.acompanantes)
          ? visita.acompanantes.length
          : 0,
      },
    });

    return res.json({
      ok: true,
      item: buildScanQrResponseItem(visita, {
        validForToday: true,
        todayLocal: todayYmd,
        citaDateLocal,
        checkedInMethod: visita.checkedInMethod || "qr",
        checkedInByName: visita.checkedInByName || getActorName(req),
      }),
      message: "Ingreso registrado correctamente",
    });
  } catch (err) {
    console.error("[visitas] scanQrCita", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Error al procesar el QR",
    });
  }
}

/**
 * GET /api/visitas/vehiculos-en-sitio
 */
export async function listVehiculosVisitasEnSitio(req, res) {
  try {
    const visitasDentro = await Visita.find({
      estado: "Dentro",
      llegoEnVehiculo: true,
      $or: [{ "vehiculo.placa": { $exists: true, $ne: "" } }],
    })
      .sort({ fechaEntrada: -1, createdAt: -1 })
      .lean();

    const citasConVehiculo = await Visita.find({
      tipo: "Agendada",
      estado: { $in: ["Programada", "En revisión", "Autorizada"] },
      llegoEnVehiculo: true,
      $or: [{ "vehiculo.placa": { $exists: true, $ne: "" } }],
    })
      .sort({ citaAt: 1, createdAt: -1 })
      .lean();

    const items = [
      ...visitasDentro.map((v) => {
        const veh = v.vehiculo;
        return {
          id: v._id.toString(),
          visitante: v.nombre,
          documento: v.documento,
          empresa: v.empresa,
          empleadoAnfitrion: v.empleado,
          vehiculoMarca: veh?.marca || "",
          vehiculoModelo: veh?.modelo || "",
          placa: veh?.placa || "",
          horaEntrada: v.fechaEntrada,
          tipo: v.tipo,
          estado: v.estado,
          acompanado: !!v.acompanado,
          cantidadAcompanantes: Array.isArray(v.acompanantes)
            ? v.acompanantes.length
            : 0,
          acompanantes: Array.isArray(v.acompanantes) ? v.acompanantes : [],
        };
      }),
      ...citasConVehiculo.map((v) => {
        const veh = v.vehiculo;
        return {
          id: v._id.toString(),
          visitante: v.nombre,
          documento: v.documento,
          empresa: v.empresa,
          empleadoAnfitrion: v.empleado,
          vehiculoMarca: veh?.marca || "",
          vehiculoModelo: veh?.modelo || "",
          placa: veh?.placa || "",
          horaEntrada: v.citaAt,
          tipo: v.tipo,
          estado: v.estado,
          acompanado: !!v.acompanado,
          cantidadAcompanantes: Array.isArray(v.acompanantes)
            ? v.acompanantes.length
            : 0,
          acompanantes: Array.isArray(v.acompanantes) ? v.acompanantes : [],
        };
      }),
    ];

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[visitas] listVehiculosVisitasEnSitio", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Error al obtener vehículos de visitas en sitio",
    });
  }
}

/**
 * GET /api/visitas/feedback/mine/pending
 */
export async function getMyPendingVisitFeedback(req, res) {
  try {
    const visitante = isVisitanteUser(req.user);

    if (!visitante) {
      return res.json({ ok: true, items: [] });
    }

    const ownMatch = buildOwnCitasMatch(req);
    if (!ownMatch) {
      return res.json({ ok: true, items: [] });
    }

    const match = {
      tipo: { $in: ["Ingreso", "Agendada"] },
      estado: "Finalizada",
      feedbackEnabled: true,
      feedbackSubmitted: { $ne: true },
    };

    if (ownMatch.$or) {
      match.$and = [ownMatch];
    } else {
      Object.assign(match, ownMatch);
    }

    const items = await Visita.find(match)
      .sort({ fechaSalida: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[visitas] getMyPendingVisitFeedback", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/visitas/feedback
 */
export async function submitVisitFeedback(req, res) {
  try {
    const visitante = isVisitanteUser(req.user);

    if (!visitante) {
      return res.status(403).json({
        ok: false,
        error: "Solo los visitantes pueden enviar esta calificación",
      });
    }

    const {
      visitaId,
      rating,
      comment = "",
      wouldRecommend = "",
    } = req.body || {};

    if (!visitaId) {
      return res.status(400).json({
        ok: false,
        error: "Debe indicar la visita a calificar",
      });
    }

    const numericRating = Number(rating);
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        ok: false,
        error: "La calificación debe estar entre 1 y 5 estrellas",
      });
    }

    const visita = await Visita.findById(visitaId);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Visita no encontrada",
      });
    }

    if (!canVisitorAnswerFeedback(req.user, visita)) {
      return res.status(403).json({
        ok: false,
        error: "No tiene permiso para calificar esta visita",
      });
    }

    if (!isVisitFinished(visita) || !visita.feedbackEnabled) {
      return res.status(409).json({
        ok: false,
        error: "La visita aún no está habilitada para ser calificada",
      });
    }

    if (visita.feedbackSubmitted) {
      return res.status(409).json({
        ok: false,
        error: "Esta visita ya fue calificada",
      });
    }

    const exists = await VisitFeedback.findOne({ visitaId: visita._id }).lean();
    if (exists) {
      visita.feedbackSubmitted = true;
      visita.feedbackScore = exists.rating || null;
      visita.feedbackSubmittedAt = exists.answeredAt || exists.createdAt || new Date();
      await visita.save();

      return res.status(409).json({
        ok: false,
        error: "Esta visita ya fue calificada",
      });
    }

    const feedback = await VisitFeedback.create({
      visitaId: visita._id,
      visitorEmail: cleanText(getUserEmail(req.user) || visita.correo || "").toLowerCase(),
      visitorName: cleanText(visita.nombre || getActorName(req)),
      documento: cleanText(visita.documento || ""),
      hostName: cleanText(visita.empleado || ""),
      empresa: cleanText(visita.empresa || ""),
      rating: numericRating,
      comment: cleanText(comment).slice(0, 1000),
      wouldRecommend: normalizeRecommendValue(wouldRecommend),
      source: "visitor_portal",
      answeredAt: new Date(),
    });

    visita.feedbackSubmitted = true;
    visita.feedbackScore = numericRating;
    visita.feedbackSubmittedAt = new Date();

    await visita.save();

    await auditFeedback(req, visita, feedback);

    return res.status(201).json({
      ok: true,
      item: feedback,
      message: "Gracias por tu opinión",
    });
  } catch (err) {
    console.error("[visitas] submitVisitFeedback", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/visitas/feedback/list
 */
export async function listVisitFeedback(req, res) {
  try {
    const {
      from,
      to,
      rating,
      withComment,
      q,
      page = 1,
      limit = 20,
    } = req.query || {};

    const match = {};

    if (from || to) {
      match.answeredAt = {};
      if (from) {
        match.answeredAt.$gte = new Date(`${from}T00:00:00.000Z`);
      }
      if (to) {
        match.answeredAt.$lte = new Date(`${to}T23:59:59.999Z`);
      }
    }

    if (rating) {
      const n = Number(rating);
      if (Number.isInteger(n) && n >= 1 && n <= 5) {
        match.rating = n;
      }
    }

    if (String(withComment || "").trim().toLowerCase() === "true") {
      match.comment = { $exists: true, $ne: "" };
    }

    if (q && String(q).trim() !== "") {
      const rx = new RegExp(String(q).trim(), "i");
      match.$or = [
        { visitorName: rx },
        { visitorEmail: rx },
        { documento: rx },
        { hostName: rx },
        { empresa: rx },
        { comment: rx },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      VisitFeedback.find(match)
        .sort({ answeredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VisitFeedback.countDocuments(match),
    ]);

    return res.json({
      ok: true,
      items,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("[visitas] listVisitFeedback", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/visitas/feedback/metrics
 */
export async function getVisitFeedbackMetrics(req, res) {
  try {
    const { from, to } = req.query || {};

    const match = {};

    if (from || to) {
      match.answeredAt = {};
      if (from) {
        match.answeredAt.$gte = new Date(`${from}T00:00:00.000Z`);
      }
      if (to) {
        match.answeredAt.$lte = new Date(`${to}T23:59:59.999Z`);
      }
    }

    const [totals] = await VisitFeedback.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalResponses: { $sum: 1 },
                averageRating: { $avg: "$rating" },
                commentedCount: {
                  $sum: {
                    $cond: [
                      { $gt: [{ $strLenCP: { $ifNull: ["$comment", ""] } }, 0] },
                      1,
                      0,
                    ],
                  },
                },
                acceptedCount: {
                  $sum: {
                    $cond: [{ $gte: ["$rating", 4] }, 1, 0],
                  },
                },
              },
            },
          ],
          distribution: [
            {
              $group: {
                _id: "$rating",
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          recommendation: [
            {
              $group: {
                _id: "$wouldRecommend",
                count: { $sum: 1 },
              },
            },
          ],
          byMonth: [
            {
              $group: {
                _id: {
                  year: { $year: "$answeredAt" },
                  month: { $month: "$answeredAt" },
                },
                count: { $sum: 1 },
                averageRating: { $avg: "$rating" },
              },
            },
            {
              $sort: {
                "_id.year": 1,
                "_id.month": 1,
              },
            },
          ],
        },
      },
    ]);

    const summary = totals?.totals?.[0] || {
      totalResponses: 0,
      averageRating: 0,
      commentedCount: 0,
      acceptedCount: 0,
    };

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of totals?.distribution || []) {
      distribution[item._id] = item.count;
    }

    const recommendation = { yes: 0, maybe: 0, no: 0 };
    for (const item of totals?.recommendation || []) {
      if (item._id && recommendation[item._id] !== undefined) {
        recommendation[item._id] = item.count;
      }
    }

    const totalResponses = summary.totalResponses || 0;
    const acceptanceRate = totalResponses
      ? Math.round((summary.acceptedCount / totalResponses) * 100)
      : 0;

    return res.json({
      ok: true,
      item: {
        totalResponses,
        averageRating: Number((summary.averageRating || 0).toFixed(2)),
        commentedCount: summary.commentedCount || 0,
        acceptedCount: summary.acceptedCount || 0,
        acceptanceRate,
        distribution,
        recommendation,
        byMonth: (totals?.byMonth || []).map((item) => ({
          year: item._id.year,
          month: item._id.month,
          count: item.count,
          averageRating: Number((item.averageRating || 0).toFixed(2)),
        })),
      },
    });
  } catch (err) {
    console.error("[visitas] getVisitFeedbackMetrics", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default {
  getVisitas,
  createVisita,
  closeVisita,
  createCita,
  updateCita,
  listCitas,
  checkinCita,
  updateCitaEstado,
  scanQrCita,
  listVehiculosVisitasEnSitio,
  getMyPendingVisitFeedback,
  submitVisitFeedback,
  listVisitFeedback,
  getVisitFeedbackMetrics,
};