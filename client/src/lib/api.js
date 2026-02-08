// client/src/lib/api.js
import axios from "axios";

/**
 * Convención del proyecto:
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
  // quita SOLO el /api final (con o sin slash)
  return s.replace(/\/api\/?$/, "");
}

const SOCKET_HOST = normalizeSocketHost(API_ROOT);

export const API = API_ROOT;
export const SOCKET_BASE = SOCKET_HOST;
export const SOCKET_BASE_URL = SOCKET_HOST;

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";
const FORCE_DEV_API = import.meta.env.VITE_FORCE_DEV_API === "1";

function getDevIdentity() {
  const email =
    (typeof localStorage !== "undefined" && localStorage.getItem("iamDevEmail")) ||
    import.meta.env.VITE_DEV_IAM_EMAIL ||
    "";

  const roles =
    (typeof localStorage !== "undefined" && localStorage.getItem("iamDevRoles")) ||
    import.meta.env.VITE_DEV_IAM_ROLES ||
    "";

  const perms =
    (typeof localStorage !== "undefined" && localStorage.getItem("iamDevPerms")) ||
    import.meta.env.VITE_DEV_IAM_PERMS ||
    "*";

  return {
    email: String(email || "").trim(),
    roles: String(roles || "").trim(),
    perms: String(perms || "*").trim() || "*",
  };
}

const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: false,
});

let tokenProvider = null;

export function attachAuth0(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

export function setAuthToken(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

api.interceptors.request.use(
  async (config) => {
    config.headers = config.headers || {};

    let token = null;

    if (tokenProvider) {
      try {
        token = await tokenProvider();
      } catch (err) {
        console.warn("[api] error obteniendo token:", err);
        token = null;
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    }

    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    const shouldSendDevHeaders = DISABLE_AUTH || isLocalhost || FORCE_DEV_API;

    if (shouldSendDevHeaders) {
      const { email, roles, perms } = getDevIdentity();

      // Fallback para evitar "anónimo" accidental en el server
      config.headers["x-user-email"] = email || "dev@local";
      if (roles) config.headers["x-roles"] = roles;
      config.headers["x-perms"] = perms || "*";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
export { api };
