// client/src/lib/api.js
import axios from "axios";

// En producción VITE_API_BASE_URL = "https://urchin-app-fuirh.ondigitalocean.app/api"
// En dev, si no hay env, usamos "http://localhost:4000/api"
const API_ROOT =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");

// 👉 Este es el endpoint base de la API
export const API = API_ROOT;

const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
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
api.interceptors.request.use(async (config) => {
  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // silencioso
    }
  }
  return config;
});

export default api;
export { api };
