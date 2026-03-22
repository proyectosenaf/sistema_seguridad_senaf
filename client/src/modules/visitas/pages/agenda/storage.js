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
        item.documento || item.dni || item.identidad || item.idNumber || ""
      );

      if (!nombre && !documento) return null;

      return {
        nombre,
        documento,
      };
    })
    .filter(Boolean);
}

export function loadStoredCitas() {
  try {
    const raw = localStorage.getItem(CITA_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    return arr.map((it) => {
      const _id = it._id || it.id || `local-${Date.now()}-${Math.random()}`;
      let citaAt = it.citaAt;

      if (!citaAt && it.fecha && it.hora) {
        const temp = new Date(`${it.fecha}T${it.hora}:00`);
        if (!Number.isNaN(temp.getTime())) {
          citaAt = temp.toISOString();
        }
      }

      return {
        ...it,
        _id,
        citaAt,
        acompanado:
          typeof it.acompanado === "boolean"
            ? it.acompanado
            : !!it.tieneAcompanante ||
              !!it.conAcompanante ||
              !!(Array.isArray(it.acompanantes) && it.acompanantes.length),
        acompanantes: normalizeCompanionArray(it.acompanantes),
      };
    });
  } catch (e) {
    console.warn("[citas] No se pudo leer de localStorage:", e);
    return [];
  }
}

export function saveStoredCitas(list) {
  try {
    localStorage.setItem(CITA_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[citas] No se pudo guardar en localStorage:", e);
  }
}
