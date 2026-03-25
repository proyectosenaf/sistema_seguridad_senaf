import {
  CITA_STORAGE_KEY,
  POSSIBLE_USER_KEYS,
  DNI_DIGITS,
} from "./constants.js";

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function readCurrentUser() {
  try {
    for (const key of POSSIBLE_USER_KEYS) {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) {
        const parsed = safeJsonParse(fromLocal);
        if (parsed) {
          if (parsed.user && typeof parsed.user === "object") return parsed.user;
          return parsed;
        }
      }

      const fromSession = sessionStorage.getItem(key);
      if (fromSession) {
        const parsed = safeJsonParse(fromSession);
        if (parsed) {
          if (parsed.user && typeof parsed.user === "object") return parsed.user;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[AgendaPage] No se pudo leer usuario actual:", err);
  }

  return null;
}

export function normalizeDocumento(raw) {
  return String(raw || "").replace(/\D/g, "");
}

export function formatDocumentoInput(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, DNI_DIGITS);

  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

export function createEmptyCompanion() {
  return {
    nombre: "",
    documento: "",
  };
}

export function normalizeCompanionArray(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (!item) return null;

      if (typeof item === "string") {
        const nombre = item.trim();
        if (!nombre) return null;

        return {
          nombre,
          documento: "",
        };
      }

      const nombre = String(
        item.nombre ||
          item.name ||
          item.fullName ||
          item.acompanante ||
          item.visitante ||
          ""
      ).trim();

      const documento = formatDocumentoInput(
        item.documento ||
          item.dni ||
          item.identidad ||
          item.idNumber ||
          item.document ||
          ""
      );

      if (!nombre && !documento) return null;

      return {
        nombre,
        documento,
      };
    })
    .filter(Boolean);
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

function shouldKeepQrFields(item) {
  const estado = normalizeEstadoValue(item?.estado || "Programada");
  return estado === "Autorizada" || estado === "Dentro";
}

function sanitizeQrFieldsByEstado(item = {}) {
  const keepQr = shouldKeepQrFields(item);

  return {
    ...item,
    qrDataUrl: keepQr ? String(item?.qrDataUrl || "").trim() : "",
    qrPayload: keepQr ? item?.qrPayload || "" : "",
    qrToken: keepQr ? String(item?.qrToken || "").trim() : "",
  };
}

/**
 * En producto serio, las citas NO deben salir de localStorage.
 * Se deja esta función para no romper imports existentes.
 */
export function loadStoredCitas() {
  return [];
}

/**
 * En producto serio, las citas NO deben persistirse en localStorage.
 * Se deja la función para compatibilidad y además limpia residuos viejos.
 */
export function saveStoredCitas(_list) {
  try {
    localStorage.removeItem(CITA_STORAGE_KEY);
  } catch (e) {
    console.warn("[citas] No se pudo limpiar localStorage:", e);
  }
}

/**
 * Helper opcional por compatibilidad:
 * normaliza una cita proveniente del backend o de memoria temporal.
 * No persiste nada en navegador.
 */
export function normalizeCitaRecord(it = {}) {
  const _id = it._id || it.id || null;

  let citaAt = it.citaAt || null;
  if (!citaAt && it.fecha && it.hora) {
    const temp = new Date(`${it.fecha}T${it.hora}:00`);
    if (!Number.isNaN(temp.getTime())) {
      citaAt = temp.toISOString();
    }
  }

  const normalizedItem = {
    ...it,
    _id,
    id: it.id || _id || null,
    citaAt,
    estado: normalizeEstadoValue(it.estado),
    acompanado:
      typeof it.acompanado === "boolean"
        ? it.acompanado
        : !!it.tieneAcompanante ||
          !!it.conAcompanante ||
          !!(Array.isArray(it.acompanantes) && it.acompanantes.length),
    acompanantes: normalizeCompanionArray(it.acompanantes),
  };

  return sanitizeQrFieldsByEstado(normalizedItem);
}