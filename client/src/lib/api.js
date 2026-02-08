// client/src/lib/api.js
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

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";
const FORCE_DEV_API = import.meta.env.VITE_FORCE_DEV_API === "1";

function isLocalhostRuntime() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function getDevIdentity() {
  const email =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevEmail")) ||
    import.meta.env.VITE_DEV_IAM_EMAIL ||
    "";

  const roles =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevRoles")) ||
    import.meta.env.VITE_DEV_IAM_ROLES ||
    "";

  const perms =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevPerms")) ||
    import.meta.env.VITE_DEV_IAM_PERMS ||
    "*";

  return {
    email: String(email || "").trim(),
    roles: String(roles || "").trim(),
    perms: String(perms || "*").trim() || "*",
  };
}

/** Axios instance */
const api = axios.create({
  baseURL: API_ROOT,
  // en tu backend estás usando cors(credentials:true) y en varios fetch usas credentials: "include"
  // así que esto lo dejamos en true para no romper flujos con cookies si los usas.
  withCredentials: true,
  timeout: 30000,
});

let tokenProvider = null;

/** Inyecta provider async() => token|null */
export function attachAuth0(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}
export function setAuthToken(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

/** set header compatible con AxiosHeaders y objetos */
function setHeader(config, key, value) {
  if (!config.headers) config.headers = {};
  // Axios v1 puede usar AxiosHeaders con .set
  if (typeof config.headers.set === "function") config.headers.set(key, value);
  else config.headers[key] = value;
}

api.interceptors.request.use(
  async (config) => {
    // 1) intentar token
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
      setHeader(config, "Authorization", `Bearer ${token}`);
      return config;
    }

    // 2) Sin token -> DEV headers solo si corresponde
    const shouldSendDevHeaders =
      DISABLE_AUTH || FORCE_DEV_API || isLocalhostRuntime();

    if (shouldSendDevHeaders) {
      const { email, roles, perms } = getDevIdentity();
      setHeader(config, "x-user-email", email || "dev@local");
      if (roles) setHeader(config, "x-roles", roles);
      setHeader(config, "x-perms", perms || "*");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
export { api };
