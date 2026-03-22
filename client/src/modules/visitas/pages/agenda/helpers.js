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
  const raw = String(value || "").trim();

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

  return map[raw.toLowerCase()] || raw || "Programada";
}

export function buildISOFromDateAndTime(fecha, hora) {
  const temp = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(temp.getTime())) return null;
  return temp.toISOString();
}

function shouldKeepQrFields(item) {
  const estado = normalizeEstadoValue(item?.estado || "Programada");
  return estado === "Autorizada";
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

export function mergeServerAndLocal(serverList, localList) {
  const map = new Map();

  for (const it of serverList || []) {
    const key = it?._id || it?.id;
    if (!key) continue;

    const normalizedServerItem = sanitizeQrFieldsByEstado({
      ...it,
      acompanado:
        typeof it?.acompanado === "boolean"
          ? it.acompanado
          : !!it?.tieneAcompanante ||
            !!it?.conAcompanante ||
            !!(Array.isArray(it?.acompanantes) && it.acompanantes.length),
      acompanantes: normalizeCompanionArray(it?.acompanantes),
    });

    map.set(key, normalizedServerItem);
  }

  for (const local of localList || []) {
    const key = local?._id || local?.id;
    if (!key) continue;

    if (map.has(key)) {
      const serverItem = map.get(key);

      const merged = {
        ...local,
        ...serverItem,
        acompanado:
          typeof serverItem?.acompanado === "boolean"
            ? serverItem.acompanado
            : typeof local?.acompanado === "boolean"
            ? local.acompanado
            : !!(serverItem?.acompanantes?.length || local?.acompanantes?.length),
        acompanantes: normalizeCompanionArray(
          serverItem?.acompanantes?.length
            ? serverItem.acompanantes
            : local?.acompanantes
        ),
      };

      map.set(key, sanitizeQrFieldsByEstado(merged));
    } else {
      const normalizedLocalItem = {
        ...local,
        acompanado:
          typeof local?.acompanado === "boolean"
            ? local.acompanado
            : !!local?.acompanantes?.length,
        acompanantes: normalizeCompanionArray(local?.acompanantes),
      };

      map.set(key, sanitizeQrFieldsByEstado(normalizedLocalItem));
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