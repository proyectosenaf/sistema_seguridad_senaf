import { normalizeCompanionArray } from "./storage.js";

export function normalizeCatalogArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function normalizeBrandItem(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.label || item?.marca || item?.value || "";
}

export function normalizeModelItem(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.label || item?.modelo || item?.value || "";
}

export function normalizeEstadoValue(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    solicitada: "Programada",
    programada: "Programada",

    "en revisión": "En revisión",
    "en revision": "En revisión",
    en_revision: "En revisión",

    autorizada: "Autorizada",
    autorizado: "Autorizada",

    denegada: "Denegada",
    denegado: "Denegada",

    cancelada: "Cancelada",
    cancelado: "Cancelada",

    dentro: "Dentro",
    ingresada: "Dentro",
    ingresado: "Dentro",

    finalizada: "Finalizada",
    finalizado: "Finalizada",
  };

  return map[raw] || (String(value || "").trim() || "Programada");
}

export function buildISOFromDateAndTime(fecha, hora) {
  const temp = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(temp.getTime())) return null;
  return temp.toISOString();
}

function shouldKeepQrFields(item) {
  const estado = normalizeEstadoValue(item?.estado || "Programada");
  return estado === "Autorizada" || estado === "Dentro";
}

function sanitizeQrFieldsByEstado(item = {}) {
  const keepQr = shouldKeepQrFields(item);

  return {
    ...item,
    qrDataUrl: keepQr ? item?.qrDataUrl || "" : "",
    qrPayload: keepQr ? item?.qrPayload || "" : "",
    qrToken: keepQr ? item?.qrToken || "" : "",
  };
}

function normalizeServerItem(it = {}) {
  const _id = it?._id || it?.id;
  if (!_id) return null;

  return sanitizeQrFieldsByEstado({
    ...it,
    _id,
    id: _id,
    estado: normalizeEstadoValue(it?.estado),
    acompanado:
      typeof it?.acompanado === "boolean"
        ? it.acompanado
        : !!it?.tieneAcompanante ||
          !!it?.conAcompanante ||
          !!(Array.isArray(it?.acompanantes) && it.acompanantes.length),
    acompanantes: normalizeCompanionArray(it?.acompanantes),
  });
}

function normalizeLocalItem(it = {}) {
  const _id = it?._id || it?.id;
  if (!_id) return null;

  return sanitizeQrFieldsByEstado({
    ...it,
    _id,
    id: _id,
    estado: normalizeEstadoValue(it?.estado),
    acompanado:
      typeof it?.acompanado === "boolean"
        ? it.acompanado
        : !!it?.tieneAcompanante ||
          !!it?.conAcompanante ||
          !!(Array.isArray(it?.acompanantes) && it.acompanantes.length),
    acompanantes: normalizeCompanionArray(it?.acompanantes),
  });
}

/**
 * Regla segura:
 * - backend manda siempre
 * - local solo se agrega si NO existe en backend
 * - NO se permite que local pise estado/QR/fecha/hora del servidor
 */
export function mergeServerAndLocal(serverList = [], localList = []) {
  const map = new Map();

  for (const raw of serverList) {
    const item = normalizeServerItem(raw);
    if (!item) continue;
    map.set(String(item._id), item);
  }

  for (const raw of localList) {
    const item = normalizeLocalItem(raw);
    if (!item) continue;

    const key = String(item._id);

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

export function toDisplayName(it) {
  return it?.nombre || it?.visitante || "";
}

export function toDisplayCompany(it) {
  return it?.empresa || "";
}