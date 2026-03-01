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

/** ✅ Key canónica para JWT local */
export const TOKEN_KEY = "senaf_token";

/** ✅ Helpers canónicos */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  const t = String(token || "").trim();
  if (!t) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Axios instance (JWT local por Authorization header) */
const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: false, // ✅ JWT por header, no cookies
  timeout: 30000,
});

// ✅ Adjunta token local automáticamente (si existe)
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // cache-bust opcional (evita 304 raros en dev)
  config.headers = config.headers || {};
  config.headers["Cache-Control"] = "no-store";
  config.headers["Pragma"] = "no-cache";
  return config;
});

export default api;
export { api };