// client/src/lib/api.js
import axios from "axios";

/**
 * Normaliza la base:
 * - quita barras finales
 * - si alguien puso "/api" al final en el .env, lo removemos
 *   (así puedes seguir llamando rutas como "/api/..." sin duplicar)
 */
function normalizeBaseUrl(raw) {
  const candidate =
    raw ??
    import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.VITE_API_URL ??
    "http://localhost:4000";
  const base = String(candidate).trim();
  return base
    .replace(/\/+$/, "")   // sin barra final
    .replace(/\/api$/i, ""); // si termina en /api, lo quita
}

const baseURL = normalizeBaseUrl();

const api = axios.create({
  baseURL,
  timeout: 15000,
});

// Proveedor de token (función async que retorna el JWT) — puede ser null
let tokenProvider = null;

/**
 * setAuthToken:
 * - fn async -> proveedor que devuelve token (o null)
 * - "jwt..." -> token estático
 * - null     -> elimina proveedor/token
 */
export function setAuthToken(providerOrToken) {
  if (typeof providerOrToken === "function") {
    tokenProvider = providerOrToken; // ej: () => getAccessTokenSilently(...)
  } else if (providerOrToken == null) {
    tokenProvider = null;
  } else {
    const t = String(providerOrToken);
    tokenProvider = async () => t;
  }
}

// Alias moderno
export const attachAuth0 = setAuthToken;

// Interceptor: adjunta Authorization si hay token
api.interceptors.request.use(async (config) => {
  try {
    if (tokenProvider) {
      const token = await tokenProvider();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // si falla el token, seguimos sin encabezado
  }
  return config;
});

// Export default y también nombrado para compatibilidad
export { api };       // { api }
export default api;   // default
