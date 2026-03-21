import { api } from "../../../lib/api";

function arrFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function safeDate(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date().toISOString()
    : d.toISOString();
}

function turnoFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Mañana";
  }
  const h = date.getHours();
  if (h < 12) return "Mañana";
  if (h < 19) return "Tarde";
  return "Noche";
}

function normalizeObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function normalizeBitacoraRow(row, idx = 0) {
  const rawId = row?._id || row?.id || row?.eventId || `bitacora-${idx}`;
  const fecha = safeDate(row?.fecha || row?.createdAt || row?.updatedAt);

  return {
    _id: row?._id || undefined,
    id: String(rawId),
    fecha,

    modulo: row?.modulo || "General",
    tipo: row?.tipo || "Evento",
    accion: row?.accion || row?.subtipo || "CREAR",

    entidad: row?.entidad || "",
    entidadId: row?.entidadId || row?.sourceId || "",

    agente: row?.agente || row?.usuario || row?.nombre || "Sistema",
    actorId: row?.actorId || "",
    actorEmail: row?.actorEmail || "",
    actorRol: row?.actorRol || "",

    nombre: row?.nombre || "",
    empresa: row?.empresa || "",

    turno: row?.turno || turnoFromDate(new Date(fecha)),
    titulo: row?.titulo || "",
    descripcion:
      row?.descripcion || row?.detalle || row?.message || "Sin descripción",

    prioridad: row?.prioridad || "Baja",
    estado: row?.estado || "Registrado",

    source: row?.source || "backend",
    ip: row?.ip || "",
    userAgent: row?.userAgent || "",

    visible: typeof row?.visible === "boolean" ? row.visible : true,
    archived: !!row?.archived,
    archivedAt: row?.archivedAt || null,
    archivedBy: row?.archivedBy || "",

    before: row?.before ?? null,
    after: row?.after ?? null,
    meta: normalizeObject(row?.meta, {}),

    raw: row,
  };
}

function buildQueryString(params = {}) {
  const qs = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "Todos"
    ) {
      qs.set(key, value);
    }
  });

  return qs.toString();
}

export async function fetchBitacoraEvents(params = {}) {
  const qs = buildQueryString(params);
  const url = qs ? `/bitacora/v1/events?${qs}` : `/bitacora/v1/events`;

  const { data } = await api.get(url);
  return arrFromResponse(data).map(normalizeBitacoraRow);
}

export async function fetchBitacoraEventDetail(id) {
  if (!id) {
    throw new Error("No se recibió el ID del evento para consultar detalle.");
  }

  const safeId = encodeURIComponent(String(id));

  try {
    const { data } = await api.get(`/bitacora/v1/events/${safeId}`);
    const item = data?.item || data?.data || data;

    if (!item || typeof item !== "object") {
      throw new Error("No se pudo obtener el detalle del evento.");
    }

    return normalizeBitacoraRow(item);
  } catch (err) {
    const status = err?.response?.status;

    if (status && status !== 404) {
      throw err;
    }

    const rows = await fetchBitacoraEvents();
    const found = rows.find(
      (row) => String(row._id || row.id) === String(id)
    );

    if (!found) {
      throw new Error("No se encontró el detalle del evento.");
    }

    return found;
  }
}

export async function archiveBitacoraEvent(id) {
  if (!id) {
    throw new Error("No se recibió el ID del evento a archivar.");
  }

  const safeId = encodeURIComponent(String(id));
  const { data } = await api.delete(`/bitacora/v1/events/${safeId}`);
  return data;
}

export async function deleteBitacoraEvent(id) {
  return archiveBitacoraEvent(id);
}

export async function restoreBitacoraEvent(id) {
  if (!id) {
    throw new Error("No se recibió el ID del evento a restaurar.");
  }

  const safeId = encodeURIComponent(String(id));
  const { data } = await api.patch(`/bitacora/v1/events/${safeId}/restore`);
  return data;
}