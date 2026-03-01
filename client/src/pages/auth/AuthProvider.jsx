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

/**
 * AuthProvider (canónico):
 * - ✅ NO llama /me (la sesión y permisos se resuelven en App.jsx).
 * - ✅ Token 100% centralizado en lib/api.js (senaf_token).
 * - ✅ Se re-sincroniza si el token cambia (storage/focus).
 */

const AuthContext = createContext(null);

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

const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // ✅ token inicial desde helper canónico
  const [token, setTokenState] = useState(() => getToken() || "");
  const [isLoading, setIsLoading] = useState(true);

  // Carga inicial desde storage (user + token)
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(USER_KEY);
      const u = rawUser ? safeJSONParse(rawUser) : null;
      if (u) setUser(u);

      setTokenState(getToken() || "");
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ re-sync si cambia el token (otra pestaña) y al volver a enfocar
  useEffect(() => {
    const syncFromStorage = () => {
      setTokenState(getToken() || "");
      try {
        const rawUser = localStorage.getItem(USER_KEY);
        const u = rawUser ? safeJSONParse(rawUser) : null;
        setUser(u || null);
      } catch {}
    };

    const onStorage = () => {
      // No dependemos del nombre de la key (senaf_token, token, etc.)
      // getToken() ya resuelve la fuente canónica.
      syncFromStorage();
    };

    const onFocus = () => {
      syncFromStorage();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const rawUser = localStorage.getItem(USER_KEY);
      const u = rawUser ? safeJSONParse(rawUser) : null;
      setUser(u || null);

      const t = getToken() || "";
      setTokenState(t);

      return u || null;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(async (u, tkn) => {
    if (tkn) {
      setTokenStorage(tkn);
      setTokenState(String(tkn || "").trim());
    } else {
      setTokenState(getToken() || "");
    }

    // Si viene user explícito, lo persistimos.
    if (u && typeof u === "object") {
      setUser(u);
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } catch {}
      return u;
    }

    // Si no viene user (ej: OTP), intentamos mantener/levantar el que ya exista
    try {
      const rawUser = localStorage.getItem(USER_KEY);
      const stored = rawUser ? safeJSONParse(rawUser) : null;
      if (stored) setUser(stored);
      return stored || null;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTokenState("");

    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {}

    clearToken();
  }, []);

  /* returnTo helpers */
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
    const isAuthenticated = !!token;

    return {
      user,
      token,
      isLoading,
      isAuthenticated,

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