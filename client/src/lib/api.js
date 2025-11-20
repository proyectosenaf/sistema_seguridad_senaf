// client/src/lib/api.js
import axios from "axios";

// En producción VITE_API_BASE_URL puede ser:
//   "https://urchin-app-fuirh.ondigitalocean.app/api"
// o incluso solo el host:
//   "https://urchin-app-fuirh.ondigitalocean.app"
// En dev, si no hay env, usamos "http://localhost:4000/api"
const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

// Quitamos solo el slash final, no el /api
let API_ROOT = RAW.replace(/\/$/, "");

// 👉 Para Socket.IO necesitamos SOLO el host, SIN /api
//    - Si API_ROOT termina en "/api" → SOCKET_BASE sin "api"
//    - Si API_ROOT ya es sólo el host → SOCKET_BASE = API_ROOT
let SOCKET_BASE = API_ROOT.replace(/\/api\/?$/, "");

// Por si alguien pone accidentalmente "/api/" con más cosas
if (SOCKET_BASE === API_ROOT && API_ROOT.endsWith("/api")) {
  SOCKET_BASE = API_ROOT.slice(0, -4);
}

// 👉 Este es el endpoint base de la API, tipo:
//    http://localhost:4000/api
//    https://urchin-app-fuirh.ondigitalocean.app/api
export const API = API_ROOT;

// 👉 Para Socket.IO:
//    http://localhost:4000
//    https://urchin-app-fuirh.ondigitalocean.app
export const SOCKET_BASE_URL = SOCKET_BASE;

// Flags de modo dev / auth
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";
const FORCE_DEV_API = import.meta.env.VITE_FORCE_DEV_API === "1";

// Identidad DEV (igual idea que en iamApi)
function getDevIdentity() {
  let email =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevEmail")) ||
    import.meta.env.VITE_DEV_IAM_EMAIL ||
    "";
  let roles =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevRoles")) ||
    import.meta.env.VITE_DEV_IAM_ROLES ||
    "";
  let perms =
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

// Instancia principal de Axios
const api = axios.create({
  baseURL: API_ROOT,
  // Usamos Bearer token, no cookies de sesión.
  // Si algo depende de cookies, puedes volver a `true`.
  withCredentials: false,
});

// Guardamos un proveedor de token (Auth0)
let tokenProvider = null;

/** Conecta tu proveedor de tokens (Auth0, etc.) */
export function attachAuth0(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

/** Alias de compatibilidad */
export function setAuthToken(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

// Interceptor: agrega Authorization si hay token
// y, si NO hay token, puede enviar cabeceras DEV (x-user-*)
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
      // Modo normal: JWT real
      config.headers.Authorization = `Bearer ${token}`;
    } else if (DISABLE_AUTH || FORCE_DEV_API || window.location.hostname === "localhost") {
      // Modo DEV local: usamos x-user-headers,
      // que el server fusiona con iamDevMerge
      const { email, roles, perms } = getDevIdentity();
      if (email) config.headers["x-user-email"] = email;
      if (roles) config.headers["x-roles"] = roles;
      if (perms) config.headers["x-perms"] = perms;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
export { api };
