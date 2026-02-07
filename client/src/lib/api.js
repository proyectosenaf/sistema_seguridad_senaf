  // client/src/lib/api.js
  import axios from "axios";

  const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
  let API_ROOT = RAW.replace(/\/$/, "");

  let SOCKET_HOST = API_ROOT.replace(/\/api\/?$/, "");
  if (SOCKET_HOST === API_ROOT && API_ROOT.endsWith("/api")) {
    SOCKET_HOST = API_ROOT.slice(0, -4);
  }

  export const API = API_ROOT;
  export const SOCKET_BASE = SOCKET_HOST;
  export const SOCKET_BASE_URL = SOCKET_HOST;

  const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";
  const FORCE_DEV_API = import.meta.env.VITE_FORCE_DEV_API === "1";

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
        typeof window !== "undefined" && window.location.hostname === "localhost";

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
