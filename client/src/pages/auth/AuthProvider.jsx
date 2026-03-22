import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import api, {
  getToken,
  setToken as setTokenStorage,
  clearToken,
  TOKEN_UPDATED_EVENT,
} from "../../lib/api.js";

import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";
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

function normalizeCan(v) {
  if (!v) return null;
  if (typeof v === "object" && !Array.isArray(v)) return v;

  if (typeof v === "string") {
    const parsed = safeJSONParse(v);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v == null) return fallback;

  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function pickFirstNonEmptyArray(...cands) {
  for (const c of cands) {
    const arr = normalizeArray(c);
    if (arr.length) return arr;
  }
  return [];
}

function hasPermImpl(perms, p) {
  const key = String(p || "").trim().toLowerCase();
  if (!key) return false;
  const set = new Set(uniqLower(perms));
  return set.has("*") || set.has(key);
}

function hasRoleImpl(roles, r) {
  const key = String(r || "").trim().toLowerCase();
  if (!key) return false;
  const set = new Set(uniqLower(roles));
  return set.has(key);
}

function deriveAuthFromToken(token) {
  const decoded = safeDecodeJwt(token);
  if (!decoded) {
    return {
      decoded: null,
      roles: [],
      perms: [],
      can: null,
      email: "",
      name: "",
      isSuperAdmin: false,
      id: "",
      _id: "",
      sub: "",
    };
  }

  const roles = pickFirstNonEmptyArray(
    decoded.roles,
    decoded.r,
    decoded["https://senaf/roles"]
  );

  const perms = pickFirstNonEmptyArray(
    decoded.perms,
    decoded.permissions,
    decoded.p,
    decoded["https://senaf/perms"],
    decoded["https://senaf/permissions"]
  );

  const can = normalizeCan(
    decoded.can ||
      decoded.c ||
      decoded["https://senaf/can"]
  );

  const email = String(
    decoded.email || decoded.e || decoded.user?.email || ""
  ).trim();

  const name = String(
    decoded.name || decoded.n || decoded.user?.name || ""
  ).trim();

  const sub = String(
    decoded.sub ||
      decoded.user?.sub ||
      decoded.userId ||
      decoded.uid ||
      decoded.id ||
      decoded._id ||
      decoded.user?.id ||
      decoded.user?._id ||
      ""
  ).trim();

  const id = String(
    decoded.id ||
      decoded.user?.id ||
      decoded._id ||
      decoded.user?._id ||
      decoded.userId ||
      decoded.uid ||
      sub ||
      ""
  ).trim();

  const _id = String(
    decoded._id ||
      decoded.user?._id ||
      decoded.id ||
      decoded.user?.id ||
      decoded.userId ||
      decoded.uid ||
      sub ||
      ""
  ).trim();

  const isSuperAdmin = normalizeBool(
    decoded.isSuperAdmin ??
      decoded.superadmin ??
      decoded.user?.isSuperAdmin ??
      decoded.user?.superadmin,
    false
  );

  return { decoded, roles, perms, can, email, name, isSuperAdmin, id, _id, sub };
}

function normalizeUserLike(u) {
  if (!u || typeof u !== "object") return null;

  const roles = uniqLower(u.roles);
  const perms = uniqLower(u.perms || u.permissions);
  const can = normalizeCan(u.can);

  const sub = String(
    u.sub || u.userSub || u.uid || u.userId || u.id || u._id || ""
  ).trim();

  const id = String(
    u.id || u.userId || u._id || u.uid || sub || ""
  ).trim();

  const _id = String(
    u._id || u.id || u.userId || u.uid || sub || ""
  ).trim();

  return {
    ...u,
    id: id || null,
    _id: _id || null,
    sub: sub || null,
    email: String(u.email || "").trim(),
    name: String(u.name || u.nombreCompleto || u.nombre || "").trim(),
    roles,
    perms,
    permissions: perms,
    can,
    isSuperAdmin: normalizeBool(u.isSuperAdmin ?? u.superadmin, false),
    superadmin: normalizeBool(u.superadmin ?? u.isSuperAdmin, false),
  };
}

function mergeUser(storedUser, tokenInfo) {
  const u = normalizeUserLike(storedUser) || {};
  const merged = { ...u };

  if (tokenInfo?.email) merged.email = tokenInfo.email;
  if (tokenInfo?.name) merged.name = tokenInfo.name;

  if (!merged.id && tokenInfo?.id) merged.id = tokenInfo.id;
  if (!merged._id && tokenInfo?._id) merged._id = tokenInfo._id;
  if (!merged.sub && tokenInfo?.sub) merged.sub = tokenInfo.sub;

  const storedRoles = uniqLower(u?.roles);
  const storedPerms = uniqLower(u?.perms || u?.permissions);
  const storedCan = normalizeCan(u?.can);

  const tokenRoles = uniqLower(tokenInfo?.roles);
  const tokenPerms = uniqLower(tokenInfo?.perms);
  const tokenCan = normalizeCan(tokenInfo?.can);

  merged.roles = storedRoles.length ? storedRoles : tokenRoles;
  merged.perms = storedPerms.length ? storedPerms : tokenPerms;
  merged.permissions = merged.perms;
  merged.can = storedCan || tokenCan || null;

  const storedIsSuperAdmin = normalizeBool(
    u?.isSuperAdmin ?? u?.superadmin,
    false
  );
  const tokenIsSuperAdmin = normalizeBool(tokenInfo?.isSuperAdmin, false);

  merged.isSuperAdmin = storedIsSuperAdmin || tokenIsSuperAdmin;
  merged.superadmin = merged.isSuperAdmin;
  merged._hydratedAt = new Date().toISOString();

  return merged;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken() || "");
  const [isLoading, setIsLoading] = useState(true);

  const meRequestRef = useRef(0);
  const lastSavedUserRef = useRef("");
  const focusSyncRef = useRef(0);

  const persistUserIfChanged = useCallback((nextUser) => {
    const payload = nextUser ? JSON.stringify(nextUser) : "";
    if (payload === lastSavedUserRef.current) return;

    lastSavedUserRef.current = payload;

    try {
      if (nextUser) {
        localStorage.setItem(USER_KEY, payload);
      } else {
        localStorage.removeItem(USER_KEY);
      }
      window.dispatchEvent(new Event(USER_UPDATED_EVENT));
    } catch {
      // ignore
    }
  }, []);

  const syncFromStorage = useCallback(({ withLoading = false } = {}) => {
    if (withLoading) setIsLoading(true);

    try {
      const t = getToken() || "";

      let stored = null;
      try {
        const rawUser = localStorage.getItem(USER_KEY);
        stored = rawUser ? safeJSONParse(rawUser) : null;
        lastSavedUserRef.current = rawUser || "";
      } catch {
        stored = null;
        lastSavedUserRef.current = "";
      }

      const normalizedStored = normalizeUserLike(stored);
      const tokenInfo = t ? deriveAuthFromToken(t) : null;
      const nextUser = tokenInfo
        ? mergeUser(normalizedStored, tokenInfo)
        : normalizedStored || null;

      setTokenState(t);
      setUser(nextUser || null);
      return nextUser || null;
    } catch {
      setTokenState(getToken() || "");
      setUser(null);
      return null;
    } finally {
      if (withLoading) setIsLoading(false);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const currentToken = getToken() || "";
    if (!currentToken) {
      setUser(null);
      persistUserIfChanged(null);
      return null;
    }

    const reqId = Date.now() + Math.random();
    meRequestRef.current = reqId;

    try {
      const res = await api.get("/iam/v1/me", {
        headers: {
          "Cache-Control": "no-store, no-cache",
          Pragma: "no-cache",
        },
      });

      if (meRequestRef.current !== reqId) return null;

      const payload = res?.data ?? null;
      const nextUser = normalizeUserLike(
        payload?.user && typeof payload.user === "object"
          ? {
              ...payload,
              ...payload.user,
              id:
                payload?.id ||
                payload?.user?.id ||
                payload?.userId ||
                payload?.uid ||
                payload?.user?._id ||
                payload?._id ||
                null,
              _id:
                payload?._id ||
                payload?.user?._id ||
                payload?.id ||
                payload?.user?.id ||
                payload?.userId ||
                payload?.uid ||
                null,
              sub:
                payload?.sub ||
                payload?.user?.sub ||
                payload?.userId ||
                payload?.uid ||
                payload?.id ||
                payload?._id ||
                payload?.user?.id ||
                payload?.user?._id ||
                null,
              permissions:
                payload?.permissions ||
                payload?.perms ||
                payload?.user?.permissions ||
                payload?.user?.perms ||
                [],
              perms:
                payload?.permissions ||
                payload?.perms ||
                payload?.user?.permissions ||
                payload?.user?.perms ||
                [],
              roles:
                payload?.roles ||
                payload?.user?.roles ||
                [],
              can:
                payload?.can ||
                payload?.user?.can ||
                null,
              isSuperAdmin:
                payload?.isSuperAdmin === true ||
                payload?.superadmin === true ||
                payload?.user?.isSuperAdmin === true ||
                payload?.user?.superadmin === true,
              superadmin:
                payload?.superadmin === true ||
                payload?.isSuperAdmin === true ||
                payload?.user?.superadmin === true ||
                payload?.user?.isSuperAdmin === true,
              isVisitor:
                payload?.isVisitor === true ||
                payload?.visitor === true ||
                payload?.user?.isVisitor === true ||
                payload?.user?.visitor === true,
              visitor:
                payload?.visitor === true ||
                payload?.isVisitor === true ||
                payload?.user?.visitor === true ||
                payload?.user?.isVisitor === true,
            }
          : payload
      );

      const tokenInfo = deriveAuthFromToken(currentToken);
      const merged = nextUser ? mergeUser(nextUser, tokenInfo) : null;

      setUser(merged || null);
      persistUserIfChanged(merged || null);
      return merged || null;
    } catch {
      return null;
    }
  }, [persistUserIfChanged]);

  useEffect(() => {
    syncFromStorage({ withLoading: true });
  }, [syncFromStorage]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const currentToken = getToken() || "";
      if (!currentToken) return;
      if (cancelled) return;
      await refreshMe();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshMe, token]);

  useEffect(() => {
    const onStorage = () => syncFromStorage({ withLoading: false });
    const onTokenUpdated = () => syncFromStorage({ withLoading: false });

    const onFocus = () => {
      const now = Date.now();
      if (now - focusSyncRef.current < 3000) return;
      focusSyncRef.current = now;
      syncFromStorage({ withLoading: false });
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(TOKEN_UPDATED_EVENT, onTokenUpdated);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(TOKEN_UPDATED_EVENT, onTokenUpdated);
    };
  }, [syncFromStorage]);

  const bootstrap = useCallback(async () => {
    const hydrated = syncFromStorage({ withLoading: true });
    const currentToken = getToken() || "";
    if (currentToken) {
      await refreshMe();
    }
    return hydrated;
  }, [syncFromStorage, refreshMe]);

  const login = useCallback(
    async (u, tkn) => {
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
          const normalizedInput = normalizeUserLike(u);
          nextUser = tokenInfo
            ? mergeUser(normalizedInput, tokenInfo)
            : normalizedInput;

          setUser(nextUser || null);
          persistUserIfChanged(nextUser || null);
        } else {
          let stored = null;
          try {
            const rawUser = localStorage.getItem(USER_KEY);
            stored = rawUser ? safeJSONParse(rawUser) : null;
          } catch {
            stored = null;
          }

          const normalizedStored = normalizeUserLike(stored);
          nextUser = tokenInfo
            ? mergeUser(normalizedStored, tokenInfo)
            : normalizedStored || null;

          setUser(nextUser || null);
          persistUserIfChanged(nextUser || null);
        }

        if (nextToken) {
          await refreshMe();
        }

        return nextUser || null;
      } finally {
        setIsLoading(false);
      }
    },
    [token, persistUserIfChanged, refreshMe]
  );

  const logout = useCallback(() => {
    setUser(null);
    setTokenState("");
    persistUserIfChanged(null);

    try {
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {
      // ignore
    }

    clearToken();
  }, [persistUserIfChanged]);

  const setReturnTo = useCallback((path) => {
    if (!safeInternalPath(path)) return;
    try {
      sessionStorage.setItem(RETURN_TO_KEY, path);
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => {
    const roles = uniqLower(user?.roles);
    const perms = uniqLower(user?.perms || user?.permissions);
    const can = user?.can && typeof user.can === "object" ? user.can : null;
    const isSuperAdmin = normalizeBool(
      user?.isSuperAdmin ?? user?.superadmin,
      false
    );

    const isAuthenticated =
      !isLoading &&
      (!!String(token || "").trim() || !!String(user?.email || "").trim());

    const isVisitor =
      roles.includes("visita") ||
      roles.includes("visitor") ||
      roles.includes("visitante");

    const displayName =
      String(user?.name || "").trim() ||
      String(user?.nombreCompleto || "").trim() ||
      String(user?.email || "").trim() ||
      "";

    const hasPerm = (p) => isSuperAdmin || hasPermImpl(perms, p);
    const hasRole = (r) => hasRoleImpl(roles, r);
    const requirePerm = (p) => isAuthenticated && hasPerm(p);

    const isAdminLike =
      isSuperAdmin ||
      hasPerm("*") ||
      hasRole("admin") ||
      hasPerm("iam.users.write") ||
      hasPerm("iam.roles.write") ||
      hasPerm("iam.users.manage") ||
      hasPerm("iam.roles.manage") ||
      can?.["iam.admin"] === true;

    const isSupervisorLike =
      isAdminLike ||
      hasRole("supervisor") ||
      hasPerm("rondasqr.reports.read") ||
      hasPerm("rondasqr.reports") ||
      hasPerm("rondasqr.view") ||
      can?.["rondasqr.reports"] === true ||
      can?.["rondasqr.view"] === true;

    return {
      user,
      token,
      isLoading,
      isAuthenticated,

      roles,
      perms,
      permissions: perms,
      can,
      isVisitor,
      isSuperAdmin,
      displayName,

      hasPerm,
      hasRole,
      requirePerm,

      isAdminLike,
      isSupervisorLike,

      login,
      logout,
      bootstrap,
      refreshMe,

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
    refreshMe,
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