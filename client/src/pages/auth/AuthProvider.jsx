
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

function safeJSONParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carga inicial desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("senaf_user");
      if (raw) {
        const u = safeJSONParse(raw);
        if (u) setUser(u);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const api = useMemo(() => {
    const token = localStorage.getItem("senaf_token");
    const hasToken = !!token;

    return {
      user,
      isLoading,

      // ✅ autenticado si hay user o token
      isAuthenticated: !!user || hasToken,

      // ✅ login permite setear user y token (token opcional)
      login: (u, tkn) => {
        if (tkn) {
          try {
            localStorage.setItem("senaf_token", tkn);
          } catch {}
        }
        if (u) {
          setUser(u);
          try {
            localStorage.setItem("senaf_user", JSON.stringify(u));
          } catch {}
        }
      },

      logout: () => {
        setUser(null);
        try {
          localStorage.removeItem("senaf_user");
          localStorage.removeItem("senaf_token");
        } catch {}
      },
    };
  }, [user, isLoading]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider />");
  return ctx;
}
