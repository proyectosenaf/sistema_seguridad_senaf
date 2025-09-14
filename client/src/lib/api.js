// client/src/lib/api.js
import axios from "axios";

// Normaliza baseURL (sin barra final)
const base =
  (import.meta.env.VITE_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

export const api = axios.create({
  baseURL: base,
  timeout: 15000,
});

// Proveedor de token (función async que retorna el JWT) — puede ser null
let tokenProvider = null;

/**
 * Back-compat:
 * - setAuthToken(fnAsync)  -> guarda proveedor que devuelve un token (o null)
 * - setAuthToken("jwt...") -> fija un token estático
 * - setAuthToken(null)     -> elimina proveedor/token
 */
export function setAuthToken(providerOrToken) {
  if (typeof providerOrToken === "function") {
    tokenProvider = providerOrToken; // ej: () => getAccessTokenSilently(...)
  } else if (providerOrToken == null) {
    tokenProvider = null;
  } else {
    // token literal
    const t = String(providerOrToken);
    tokenProvider = async () => t;
  }
}

// Alias moderno (por si ya lo usaste en otros componentes)
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
