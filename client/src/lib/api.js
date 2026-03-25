import axios from "axios";

/**
 * Convención:
 * - VITE_API_BASE_URL incluye /api
 *   Ej: http://localhost:4000/api  |  https://dominio.com/api
 *
 * Socket.IO:
 * - vive en la raíz (sin /api)
 *   Ej: http://localhost:4000
 */

// 1) API base
const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const API_ROOT = String(RAW || "").trim().replace(/\/$/, "");

// 2) Socket base = API_ROOT sin /api (solo si está al final)
function normalizeSocketHost(apiRoot) {
  const s = String(apiRoot || "").trim().replace(/\/$/, "");
  return s.replace(/\/api\/?$/, "");
}

const SOCKET_HOST = normalizeSocketHost(API_ROOT);

export const API = API_ROOT;
export const SOCKET_BASE = SOCKET_HOST;
export const SOCKET_BASE_URL = SOCKET_HOST;

/** ✅ Key canónica para JWT local */
export const TOKEN_KEY = "senaf_token";

/** ⚠️ Key legacy (compatibilidad con módulos viejos) */
export const TOKEN_KEY_LEGACY = "token";

/** ✅ Evento para notificar cambios de token en la MISMA pestaña */
export const TOKEN_UPDATED_EVENT = "senaf:token_updated";

/** ✅ Mensaje temporal cuando se fuerza logout por sesión reemplazada */
export const FORCED_LOGOUT_MESSAGE_KEY = "senaf_forced_logout_message";

function emitTokenUpdated() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(TOKEN_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
}

/* =========================
   Storage safe helpers
========================= */
function safeStorageGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeStorageSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeSessionGet(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeSessionSet(key, val) {
  try {
    sessionStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function safeSessionRemove(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* =========================
   Token helpers (canónicos)
========================= */

/**
 * ✅ Obtiene token:
 * - Primero senaf_token (canónico)
 * - Fallback token (legacy)
 * - Si encuentra legacy, lo migra a canónico
 */
export function getToken() {
  const canonical = safeStorageGet(TOKEN_KEY);
  if (canonical) return canonical;

  const legacy = safeStorageGet(TOKEN_KEY_LEGACY);
  if (legacy) {
    safeStorageSet(TOKEN_KEY, legacy);
    safeStorageRemove(TOKEN_KEY_LEGACY);
    emitTokenUpdated();
    return legacy;
  }

  return "";
}

/**
 * ✅ Set token:
 * - Escribe en canónico
 * - Limpia legacy para evitar duplicados
 */
export function setToken(token) {
  const t = String(token || "").trim();
  if (!t) {
    safeStorageRemove(TOKEN_KEY);
    safeStorageRemove(TOKEN_KEY_LEGACY);
    emitTokenUpdated();
    return;
  }

  safeStorageSet(TOKEN_KEY, t);
  safeStorageRemove(TOKEN_KEY_LEGACY);
  emitTokenUpdated();
}

/** ✅ Limpia token (canónico + legacy) */
export function clearToken() {
  safeStorageRemove(TOKEN_KEY);
  safeStorageRemove(TOKEN_KEY_LEGACY);
  emitTokenUpdated();
}

/* =========================
   Auth cleanup helpers
========================= */

export function clearAuthStorage() {
  clearToken();

  // user payloads / flags usados por SENAF
  safeStorageRemove("senaf_user");
  safeSessionRemove("senaf_user");

  safeStorageRemove("senaf_is_visitor");
  safeSessionRemove("senaf_is_visitor");

  safeStorageRemove("user");
  safeSessionRemove("user");

  safeStorageRemove("auth_user");
  safeSessionRemove("auth_user");

  safeStorageRemove("visitor");
  safeSessionRemove("visitor");
}

export function setForcedLogoutMessage(message) {
  const msg = String(message || "").trim();
  if (!msg) return;

  safeStorageSet(FORCED_LOGOUT_MESSAGE_KEY, msg);
  safeSessionSet(FORCED_LOGOUT_MESSAGE_KEY, msg);
}

export function readForcedLogoutMessage() {
  const localMsg = safeStorageGet(FORCED_LOGOUT_MESSAGE_KEY);
  if (localMsg) return localMsg;

  const sessionMsg = safeSessionGet(FORCED_LOGOUT_MESSAGE_KEY);
  if (sessionMsg) return sessionMsg;

  return "";
}

export function clearForcedLogoutMessage() {
  safeStorageRemove(FORCED_LOGOUT_MESSAGE_KEY);
  safeSessionRemove(FORCED_LOGOUT_MESSAGE_KEY);
}

function redirectToLogin() {
  try {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname || "/";
    const currentSearch = window.location.search || "";
    const currentHash = window.location.hash || "";
    const currentFullPath = `${currentPath}${currentSearch}${currentHash}`;

    if (currentPath === "/login") return;

    const encodedNext = encodeURIComponent(currentFullPath);
    window.location.replace(`/login?reason=session_replaced&next=${encodedNext}`);
  } catch {
    // ignore
  }
}

function handleForcedLogout(serverMessage) {
  const fallback =
    "Solo se permite una sesión activa por cuenta. Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.";

  clearAuthStorage();
  setForcedLogoutMessage(serverMessage || fallback);
  redirectToLogin();
}

/* =========================
   Axios instance
========================= */

const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: false,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    config.headers = config.headers || {};

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers["Cache-Control"] =
      "no-store, no-cache, must-revalidate, proxy-revalidate";
    config.headers.Pragma = "no-cache";

    return config;
  },
  (error) => Promise.reject(error)
);

// ⚠️ No limpiar token en cualquier 401.
// Solo forzar logout si el backend lo marca explícitamente.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data || {};
    const errCode = String(data?.error || "").trim();
    const forceLogout = data?.forceLogout === true;

    const isSessionInvalidated =
      forceLogout ||
      errCode === "session_invalidated" ||
      errCode === "invalid_session_replaced";

    if (status === 401 && isSessionInvalidated) {
      handleForcedLogout(data?.message);
    }

    return Promise.reject(error);
  }
);

export default api;
export { api };