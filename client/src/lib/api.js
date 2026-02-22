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

// Detectar producción de forma robusta en Vite
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

const DEBUG_API = String(import.meta.env.VITE_API_DEBUG || "") === "1";

function isLocalhostRuntime() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

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

/** Axios instance */
const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
  timeout: 30000,
});

let tokenProvider = null;

/** Inyecta provider async() => token|null (Auth0) */
export function attachAuth0(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}
export function setAuthToken(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

/** Helpers para token local */
export function setLocalToken(token) {
  try {
    if (typeof localStorage !== "undefined") {
      if (token) localStorage.setItem("token", String(token));
      else localStorage.removeItem("token");
    }
  } catch {}
}
export function clearLocalToken() {
  return setLocalToken(null);
}

function getLocalToken() {
  try {
    if (typeof localStorage === "undefined") return null;
    const t = localStorage.getItem("token");
    return t ? String(t).trim() : null;
  } catch {
    return null;
  }
}

/** set header compatible con AxiosHeaders y objetos */
function setHeader(config, key, value) {
  if (!config.headers) config.headers = {};
  if (typeof config.headers.set === "function") config.headers.set(key, value);
  else config.headers[key] = value;
}

function looksLikeJwt(t) {
  return typeof t === "string" && t.split(".").length === 3;
}

function normalizeToken(t) {
  if (typeof t !== "string") return null;
  const s = t.trim();
  return s ? s : null;
}

// ✅ No mandar Authorization en endpoints públicos de auth
function isPublicAuthEndpoint(config) {
  const url = String(config?.url || "");
  // config.url suele venir relativo: "/iam/v1/auth/login"
  return url.includes("/iam/v1/auth/login") || url.includes("/iam/v1/auth/bootstrap");
}

// ✅ Detectar endpoints de IAM v1 (para no mandar token local HS256 en PROD)
function isIamV1Endpoint(config) {
  const url = String(config?.url || "");
  return url.includes("/iam/v1/");
}

api.interceptors.request.use(
  async (config) => {
    // ✅ IMPORTANTÍSIMO: login/bootstrap deben ir sin Authorization
    if (isPublicAuthEndpoint(config)) {
      if (DEBUG_API) console.log("[api] public auth endpoint:", config.url);
      return config;
    }

    // DEV headers cuando auth está deshabilitado
    if (DISABLE_AUTH) {
      const shouldSendDevHeaders = DISABLE_AUTH || FORCE_DEV_API || isLocalhostRuntime();
      if (shouldSendDevHeaders) {
        const { email, roles, perms } = getDevIdentity();
        if (email) setHeader(config, "x-user-email", email);
        if (roles) setHeader(config, "x-roles", roles);
        setHeader(config, "x-perms", perms || "*");
      }
      return config;
    }

    // 1) token Auth0 (RS256) desde provider
    let token = null;
    if (tokenProvider) {
      try {
        token = normalizeToken(await tokenProvider());
      } catch (err) {
        if (DEBUG_API) console.warn("[api] tokenProvider failed:", err);
        token = null;
      }
    }

    // ✅ Solo seteamos Authorization si token existe y parece JWT
    if (token && looksLikeJwt(token)) {
      setHeader(config, "Authorization", `Bearer ${token}`);
      return config;
    }

    /**
     * 2) fallback token local (HS256)
     * ✅ PERO: en PRODUCCIÓN NO se permite para /iam/v1/*
     */
    if (!(IS_PROD && isIamV1Endpoint(config))) {
      const localToken = normalizeToken(getLocalToken());
      if (localToken && looksLikeJwt(localToken)) {
        setHeader(config, "Authorization", `Bearer ${localToken}`);
        return config;
      }
    }

    // 3) dev headers (solo entornos dev/local)
    const shouldSendDevHeaders = FORCE_DEV_API || isLocalhostRuntime();
    if (shouldSendDevHeaders) {
      const { email, roles, perms } = getDevIdentity();
      if (email) setHeader(config, "x-user-email", email);
      if (roles) setHeader(config, "x-roles", roles);
      setHeader(config, "x-perms", perms || "*");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
export { api };