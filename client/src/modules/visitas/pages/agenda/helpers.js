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

export function mergeServerAndLocal(serverList, localList) {
  const map = new Map();

  for (const it of serverList || []) {
    const key = it?._id || it?.id;
    if (!key) continue;
    map.set(key, {
      ...it,
      acompanado:
        typeof it?.acompanado === "boolean"
          ? it.acompanado
          : !!it?.tieneAcompanante ||
            !!it?.conAcompanante ||
            !!(Array.isArray(it?.acompanantes) && it.acompanantes.length),
      acompanantes: normalizeCompanionArray(it?.acompanantes),
    });
  }

  for (const local of localList || []) {
    const key = local?._id || local?.id;
    if (!key) continue;

    if (map.has(key)) {
      map.set(key, {
        ...local,
        ...map.get(key),
        acompanado:
          typeof map.get(key)?.acompanado === "boolean"
            ? map.get(key)?.acompanado
            : typeof local?.acompanado === "boolean"
            ? local.acompanado
            : !!(map.get(key)?.acompanantes?.length || local?.acompanantes?.length),
        acompanantes: normalizeCompanionArray(
          map.get(key)?.acompanantes?.length
            ? map.get(key)?.acompanantes
            : local?.acompanantes
        ),
        qrDataUrl: map.get(key)?.qrDataUrl || local?.qrDataUrl || "",
        qrPayload: map.get(key)?.qrPayload || local?.qrPayload || "",
        qrToken: map.get(key)?.qrToken || local?.qrToken || "",
      });
    } else {
      map.set(key, {
        ...local,
        acompanado:
          typeof local?.acompanado === "boolean"
            ? local.acompanado
            : !!local?.acompanantes?.length,
        acompanantes: normalizeCompanionArray(local?.acompanantes),
      });
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
