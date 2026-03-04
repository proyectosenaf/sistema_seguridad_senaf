// client/src/pages/auth/AuthProvider.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getToken,
  setToken as setTokenStorage,
  clearToken,
} from "../../lib/api.js";

import { jwtDecode } from "jwt-decode";

/**
 * AuthProvider (canónico):
 * - NO llama /me (eso lo resuelve App.jsx).
 * - Token centralizado en lib/api.js (senaf_token).
 * - Se re-sincroniza si el token cambia (storage/focus).
 *
 * FIX:
 * - Hidratación robusta en refresh: token + user.
 * - Deriva roles/perms desde JWT para decidir UI (sidebar) desde el primer render.
 * - Evita “menu completo” durante loading.
 *
 * ✅ NEW:
 * - Deriva name desde JWT y lo usa como displayName (fallback a email).
 */

const AuthContext = createContext(null);

const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";

function safeJSONParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

function safeDecodeJwt(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

function normalizeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/**
 * Extrae roles/perms/email/name desde el token si los tienes embebidos.
 * Ajusta aquí si tu payload usa otros nombres.
 */
function deriveAuthFromToken(token) {
  const decoded = safeDecodeJwt(token);
  if (!decoded) {
    return { decoded: null, roles: [], perms: [], email: "", name: "" };
  }

  // soporta varios nombres comunes
  const roles =
    normalizeArray(decoded.roles) ||
    normalizeArray(decoded.r) ||
    normalizeArray(decoded["https://senaf/roles"]) ||
    [];

  const perms =
    normalizeArray(decoded.perms) ||
    normalizeArray(decoded.p) ||
    normalizeArray(decoded["https://senaf/perms"]) ||
    [];

  const email = String(decoded.email || decoded.e || decoded.user?.email || "").trim();

  // ✅ name: según tu backend firmas `name: user.name || user.email`
  const name = String(decoded.name || decoded.n || decoded.user?.name || "").trim();

  return { decoded, roles, perms, email, name };
}

function mergeUser(storedUser, tokenInfo) {
  // Si ya existe user guardado, lo respetamos, pero garantizamos roles/perms/email/name si vienen del token.
  const u = storedUser && typeof storedUser === "object" ? storedUser : null;

  const merged = {
    ...(u || {}),
  };

  // email: token gana si hay uno válido
  if (tokenInfo?.email) merged.email = tokenInfo.email;

  // ✅ name: token gana si trae uno válido (si no, conserva lo guardado)
  if (tokenInfo?.name) merged.name = tokenInfo.name;

  // roles/perms: token gana si trae algo, si no, conserva lo guardado
  const uRoles = normalizeArray(u?.roles);
  const uPerms = normalizeArray(u?.perms);

  merged.roles = tokenInfo?.roles?.length ? tokenInfo.roles : uRoles;
  merged.perms = tokenInfo?.perms?.length ? tokenInfo.perms : uPerms;

  // marca interna útil para debug (opcional)
  merged._hydratedAt = new Date().toISOString();

  return merged;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // token inicial desde helper canónico
  const [token, setTokenState] = useState(() => getToken() || "");

  // ⚠️ importante: sidebar debe esperar a que esto sea false
  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────
  // Hidratación inicial (refresh)
  // ─────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const hydrate = () => {
      setIsLoading(true);

      try {
        const t = getToken() || "";
        const rawUser = localStorage.getItem(USER_KEY);
        const stored = rawUser ? safeJSONParse(rawUser) : null;

        const tokenInfo = t ? deriveAuthFromToken(t) : null;

        const nextUser = tokenInfo ? mergeUser(stored, tokenInfo) : stored || null;

        if (!alive) return;
        setTokenState(t);
        setUser(nextUser || null);
      } catch {
        if (!alive) return;
        setTokenState(getToken() || "");
        setUser(null);
      } finally {
        if (!alive) return;
        setIsLoading(false);
      }
    };

    hydrate();

    return () => {
      alive = false;
    };
  }, []);

  // ─────────────────────────────────────────────
  // Re-sync si cambia storage (otra pestaña) y al enfocar
  // ─────────────────────────────────────────────
  useEffect(() => {
    const syncFromStorage = () => {
      setIsLoading(true);
      try {
        const t = getToken() || "";
        const rawUser = localStorage.getItem(USER_KEY);
        const stored = rawUser ? safeJSONParse(rawUser) : null;

        const tokenInfo = t ? deriveAuthFromToken(t) : null;
        const nextUser = tokenInfo ? mergeUser(stored, tokenInfo) : stored || null;

        setTokenState(t);
        setUser(nextUser || null);
      } catch {
        setTokenState(getToken() || "");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    const onStorage = () => syncFromStorage();
    const onFocus = () => syncFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // ─────────────────────────────────────────────
  // bootstrap(): expone la hidratación manual
  // ─────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      const t = getToken() || "";
      const rawUser = localStorage.getItem(USER_KEY);
      const stored = rawUser ? safeJSONParse(rawUser) : null;

      const tokenInfo = t ? deriveAuthFromToken(t) : null;
      const nextUser = tokenInfo ? mergeUser(stored, tokenInfo) : stored || null;

      setTokenState(t);
      setUser(nextUser || null);

      return nextUser || null;
    } catch {
      setTokenState(getToken() || "");
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * login(u, tkn)
   * - si viene token => persistirlo en storage y state
   * - si viene user => persistirlo (USER_KEY)
   * - si NO viene user, intenta hidratar desde storage/token
   */
  const login = useCallback(async (u, tkn) => {
    setIsLoading(true);

    try {
      let nextToken = token;

      if (tkn) {
        const clean = String(tkn || "").trim();
        setTokenStorage(clean);
        setTokenState(clean);
        nextToken = clean;
      } else {
        const t = getToken() || "";
        setTokenState(t);
        nextToken = t;
      }

      const tokenInfo = nextToken ? deriveAuthFromToken(nextToken) : null;

      let nextUser = null;

      if (u && typeof u === "object") {
        // merge con token para asegurar roles/perms/email/name
        nextUser = tokenInfo ? mergeUser(u, tokenInfo) : u;

        setUser(nextUser);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        } catch {}

        return nextUser;
      }

      // si no viene user (ej OTP), mantener/levantar el que exista
      const rawUser = localStorage.getItem(USER_KEY);
      const stored = rawUser ? safeJSONParse(rawUser) : null;

      nextUser = tokenInfo ? mergeUser(stored, tokenInfo) : stored || null;

      setUser(nextUser || null);
      return nextUser || null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const logout = useCallback(() => {
    setUser(null);
    setTokenState("");

    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {}

    clearToken();
  }, []);

  // returnTo helpers
  const setReturnTo = useCallback((path) => {
    if (!safeInternalPath(path)) return;
    try {
      sessionStorage.setItem(RETURN_TO_KEY, path);
    } catch {}
  }, []);

  const getReturnTo = useCallback(() => {
    try {
      const p = sessionStorage.getItem(RETURN_TO_KEY);
      return safeInternalPath(p) ? p : null;
    } catch {
      return null;
    }
  }, []);

  const clearReturnTo = useCallback(() => {
    try {
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {}
  }, []);

  const value = useMemo(() => {
    // ✅ no marques authenticated mientras está cargando
    const isAuthenticated = !isLoading && !!token;

    // roles/perms listos desde user (hidratado con token)
    const roles = normalizeArray(user?.roles);
    const perms = normalizeArray(user?.perms);

    const isVisitor =
      roles.map((r) => r.toLowerCase()).includes("visita") ||
      roles.map((r) => r.toLowerCase()).includes("visitor");

    // ✅ Nombre a mostrar (fallback)
    const displayName =
      String(user?.name || "").trim() ||
      String(user?.nombreCompleto || "").trim() ||
      String(user?.email || "").trim() ||
      "";

    return {
      user,
      token,
      isLoading,
      isAuthenticated,

      roles,
      perms,
      isVisitor,

      displayName, // <- úsalo en el header

      login,
      logout,
      bootstrap,

      setReturnTo,
      getReturnTo,
      clearReturnTo,
    };
  }, [
    user,
    token,
    isLoading,
    login,
    logout,
    bootstrap,
    setReturnTo,
    getReturnTo,
    clearReturnTo,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider />");
  return ctx;
}