// client/src/lib/api.js
import axios from "axios";

// En producción VITE_API_BASE_URL = "https://urchin-app-fuirh.ondigitalocean.app/api"
// En dev, si no hay env, usamos "http://localhost:4000/api"
const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

// Quitamos solo el slash final, no el /api
const API_ROOT = RAW.replace(/\/$/, "");

// 👉 Este es el endpoint base de la API, tipo:
//    http://localhost:4000/api
//    https://urchin-app-fuirh.ondigitalocean.app/api
export const API = API_ROOT;

// 👉 Para Socket.IO necesitamos SOLO el host, SIN /api
//    http://localhost:4000
//    https://urchin-app-fuirh.ondigitalocean.app
export const SOCKET_BASE = API_ROOT.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_ROOT,
  // Usamos Bearer token, no cookies de sesión.
  // Si tienes algo que dependa de cookies, puedes volver a true.
  withCredentials: false,
});

// Guardamos un proveedor de token (Auth0)
let tokenProvider = null;

/** Conecta tu proveedor de tokens (Auth0) */
export function attachAuth0(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

/** Alias de compatibilidad */
export function setAuthToken(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

// Interceptor: agrega Authorization si hay token
api.interceptors.request.use(
  async (config) => {
    if (tokenProvider) {
      try {
        const token = await tokenProvider();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // silencioso en caso de error al obtener token
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
export { api };
