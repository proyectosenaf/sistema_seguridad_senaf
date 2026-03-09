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
  TOKEN_UPDATED_EVENT, // ✅ escucha cambios de token en la misma tab
} from "../../lib/api.js";

import { jwtDecode } from "jwt-decode";

/**
 * AuthProvider (canónico):
 * - NO llama /me (eso lo resuelve App.jsx si lo necesitas).
 * - Token centralizado en lib/api.js (senaf_token).
 * - Se re-sincroniza si el token cambia (storage/focus) y por evento interno.
 *
 * ✅ Centralización:
 * - Roles/perms/can salen SOLO del token y/o del storedUser (si token no los trae).
 * - Helpers: hasPerm/hasRole/requirePerm para que NADIE duplique lógica.
 */

const AuthContext = createContext(null);

const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";

// ✅ evento interno para sincronizar en la misma pestaña (storage NO dispara en la misma tab)
const USER_UPDATED_EVENT = "senaf:user_updated";

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

function uniqLower(arr) {
  return Array.from(
    new Set(
      normalizeArray(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function pickFirstNonEmptyArray(...cands) {
  for (const c of cands) {
    const arr = normalizeArray(c);
    if (arr.length) return arr;
  }
  return [];
}

/** Perm check: soporta "*" */
function hasPermImpl(perms, p) {
  const key = String(p || "").trim().toLowerCase();
  if (!key) return false;
  const set = new Set(uniqLower(perms));
  return set.has("*") || set.has(key);
}

/** Role check */
function hasRoleImpl(roles, r) {
  const key = String(r || "").trim().toLowerCase();
  if (!key) return false;
  const set = new Set(uniqLower(roles));
  return set.has(key);
}

function normalizeCan(v) {
  if (!v) return null;
  if (typeof v === "object" && !Array.isArray(v)) return v;

  // por si viene string JSON en el token
  if (typeof v === "string") {
    const parsed = safeJSONParse(v);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }
  return null;
}

/**
 * Extrae roles/perms/can/email/name desde el token.
 * Ajusta aquí si tu payload usa otros nombres.
 */
function deriveAuthFromToken(token) {
  const decoded = safeDecodeJwt(token);
  if (!decoded) {
    return { decoded: null, roles: [], perms: [], can: null, email: "", name: "" };
  }

  // ✅ IMPORTANTÍSIMO: no uses `a || b` con arrays, porque [] es truthy.
  const roles = pickFirstNonEmptyArray(
    decoded.roles,
    decoded.r,
    decoded["https://senaf/roles"]
  );

  const perms = pickFirstNonEmptyArray(
    decoded.perms,
    decoded.p,
    decoded["https://senaf/perms"]
  );

  // ✅ ACL por clave: { "rondasqr.reports": true, "rondasqr.admin": true, ... }
  const can = normalizeCan(decoded.can || decoded.c || decoded["https://senaf/can"]);

  const email = String(decoded.email || decoded.e || decoded.user?.email || "").trim();

  // backend firma `name: user.name || user.email`
  const name = String(decoded.name || decoded.n || decoded.user?.name || "").trim();

  return { decoded, roles, perms, can, email, name };
}

function mergeUser(storedUser, tokenInfo) {
  const u = storedUser && typeof storedUser === "object" ? storedUser : null;
  const merged = { ...(u || {}) };

  if (tokenInfo?.email) merged.email = tokenInfo.email;
  if (tokenInfo?.name) merged.name = tokenInfo.name;

  // roles/perms/can SOLO del token si vienen; si no, conserva almacenado
  const uRoles = normalizeArray(u?.roles);
  const uPerms = normalizeArray(u?.perms);
  const uCan = normalizeCan(u?.can);

  merged.roles = tokenInfo?.roles?.length ? tokenInfo.roles : uRoles;
  merged.perms = tokenInfo?.perms?.length ? tokenInfo.perms : uPerms;
  merged.can = tokenInfo?.can ? tokenInfo.can : uCan;

  merged._hydratedAt = new Date().toISOString();
  return merged;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken() || "");
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Un solo sync central (lo usan todos los listeners)
  const syncFromStorage = useCallback(() => {
    setIsLoading(true);
    try {
      const t = getToken() || "";

      let stored = null;
      try {
        const rawUser = localStorage.getItem(USER_KEY);
        stored = rawUser ? safeJSONParse(rawUser) : null;
      } catch {
        stored = null;
      }

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

  // Hidratación inicial (refresh)
  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  // Re-sync:
  // - storage (otra pestaña)
  // - focus (misma pestaña al volver)
  // - USER_UPDATED_EVENT (cuando App.jsx persiste /me en senaf_user en misma tab)
  // - TOKEN_UPDATED_EVENT (cuando lib/api.js setToken/clearToken/migración legacy en misma tab)
  useEffect(() => {
    const onStorage = () => syncFromStorage();
    const onFocus = () => syncFromStorage();
    const onUserUpdated = () => syncFromStorage();
    const onTokenUpdated = () => syncFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(USER_UPDATED_EVENT, onUserUpdated);
    window.addEventListener(TOKEN_UPDATED_EVENT, onTokenUpdated);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(USER_UPDATED_EVENT, onUserUpdated);
      window.removeEventListener(TOKEN_UPDATED_EVENT, onTokenUpdated);
    };
  }, [syncFromStorage]);

  // bootstrap(): expone hidratación manual
  const bootstrap = useCallback(async () => {
    return syncFromStorage();
  }, [syncFromStorage]);

  /**
   * login(u, tkn)
   */
  const login = useCallback(
    async (u, tkn) => {
      setIsLoading(true);

      try {
        let nextToken = token;

        if (tkn) {
          const clean = String(tkn || "").trim();
          // ✅ esto dispara TOKEN_UPDATED_EVENT desde lib/api.js
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
          nextUser = tokenInfo ? mergeUser(u, tokenInfo) : u;

          setUser(nextUser);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
            // ✅ notifica a la misma tab (por si el token no trae can/roles/perms)
            window.dispatchEvent(new Event(USER_UPDATED_EVENT));
          } catch {}

          return nextUser;
        }

        let stored = null;
        try {
          const rawUser = localStorage.getItem(USER_KEY);
          stored = rawUser ? safeJSONParse(rawUser) : null;
        } catch {
          stored = null;
        }

        nextUser = tokenInfo ? mergeUser(stored, tokenInfo) : stored || null;

        setUser(nextUser || null);
        return nextUser || null;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const logout = useCallback(() => {
    setUser(null);
    setTokenState("");

    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
      window.dispatchEvent(new Event(USER_UPDATED_EVENT));
    } catch {}

    // ✅ esto dispara TOKEN_UPDATED_EVENT desde lib/api.js
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
    const isAuthenticated = !isLoading && !!token;

    // ✅ Normalizados a minúsculas únicos
    const roles = uniqLower(user?.roles);
    const perms = uniqLower(user?.perms);
    const can = user?.can && typeof user.can === "object" ? user.can : null;

    const isVisitor = roles.includes("visita") || roles.includes("visitor");

    const displayName =
      String(user?.name || "").trim() ||
      String(user?.nombreCompleto || "").trim() ||
      String(user?.email || "").trim() ||
      "";

    // ✅ Helpers centralizados (nadie duplica)
    const hasPerm = (p) => hasPermImpl(perms, p);
    const hasRole = (r) => hasRoleImpl(roles, r);
    const requirePerm = (p) => isAuthenticated && hasPerm(p);

    /**
     * ✅ Flags “like” (consumidos por UI como ScanPage)
     * - NO inventan roles/perms: solo consultan roles/perms/can ya provistos.
     */
    const isAdminLike =
      hasPerm("*") ||
      hasRole("admin") ||
      can?.["rondasqr.admin"] === true ||
      hasPerm("rondasqr.admin") ||
      can?.["iam.admin"] === true ||
      hasPerm("iam.admin");

    const isSupervisorLike =
      isAdminLike ||
      hasRole("supervisor") ||
      can?.["rondasqr.reports"] === true ||
      can?.["rondasqr.view"] === true ||
      hasPerm("rondasqr.reports") ||
      hasPerm("rondasqr.view");

    return {
      user,
      token,
      isLoading,
      isAuthenticated,

      roles,
      perms,
      can,
      isVisitor,
      displayName,

      hasPerm,
      hasRole,
      requirePerm,

      isAdminLike,
      isSupervisorLike,

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


