  // client/src/components/Sidebar.jsx
  import React, { useEffect, useMemo, useState } from "react";
  import { NavLink, useLocation, useNavigate } from "react-router-dom";
  import { Home, LogOut } from "lucide-react";

  import { useAuth } from "../pages/auth/AuthProvider.jsx";
  import api, { clearToken, getToken, TOKEN_UPDATED_EVENT } from "../lib/api.js";
  import { getNavSectionsForMe } from "../config/navConfig.js";

  const ROUTE_LOGIN =
    String(import.meta.env.VITE_ROUTE_LOGIN || "/login").trim() || "/login";

  const USER_KEY = "senaf_user";
  const RETURN_TO_KEY = "auth:returnTo";
  const VISITOR_HINT_KEY = "senaf_is_visitor";
  const USER_UPDATED_EVENT = "senaf:user_updated";

  const SUPERADMIN_EMAIL = String(
    import.meta.env.VITE_SUPERADMIN_EMAIL || "proyectosenaf@gmail.com"
  )
    .trim()
    .toLowerCase();

  // Ej: VITE_NAV_KEYS_ALLOWLIST="accesos,rondas,visitas"
  const NAV_KEYS_ALLOWLIST = String(import.meta.env.VITE_NAV_KEYS_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function isPathActive(currentPath, to) {
    if (to === "/") return currentPath === "/";
    return currentPath === to || currentPath.startsWith(to + "/");
  }

  function NavItem({ to, label, Icon, onClick, emphasizeDark = false }) {
    const { pathname } = useLocation();
    const active = isPathActive(pathname, to);

    const base =
      "group relative block rounded-[18px] transition-all duration-150 " +
      "focus-visible:outline-none focus-visible:ring-2";

    const inactive = "hover:translate-x-[1px] hover:brightness-[1.01]";
    const activeCls = "shadow-sm";

    return (
      <NavLink
        to={to}
        onClick={(e) => onClick?.(e)}
        className={[base, inactive, active ? activeCls : ""].filter(Boolean).join(" ")}
        aria-current={active ? "page" : undefined}
        style={{
          background: active
            ? "color-mix(in srgb, var(--card-solid) 84%, transparent)"
            : "transparent",
          border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
          boxShadow: active ? "var(--shadow-sm)" : "none",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {Icon ? (
            <Icon
              className="h-5 w-5 shrink-0"
              strokeWidth={active ? 2.4 : 2.1}
              style={{
                color: active
                  ? "var(--text)"
                  : emphasizeDark
                  ? "var(--text)"
                  : "var(--text-muted)",
              }}
            />
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}

          <span
            className="text-[15px] font-medium leading-none"
            style={{
              color: "var(--text)",
              opacity: active ? 1 : 0.92,
            }}
          >
            {label}
          </span>
        </div>

        {active && (
          <span
            className="absolute left-2 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full"
            aria-hidden
            style={{
              background: "linear-gradient(180deg, #2563eb, #06b6d4)",
            }}
          />
        )}
      </NavLink>
    );
  }

  function readVisitorHint() {
    try {
      return localStorage.getItem(VISITOR_HINT_KEY) === "1";
    } catch {
      return false;
    }
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
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
      try {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  function normalizeMePayload(payload) {
    if (!payload || typeof payload !== "object") return null;

    const root = payload;
    const userObj = payload.user && typeof payload.user === "object" ? payload.user : null;
    const meObj = payload.me && typeof payload.me === "object" ? payload.me : null;

    const source = meObj || userObj || root;

    const email =
      normalizeEmail(source?.email) ||
      normalizeEmail(userObj?.email) ||
      normalizeEmail(root?.email) ||
      "";

    const roles = uniqLower(
      source?.roles ??
        root?.roles ??
        userObj?.roles ??
        []
    );

    const permissions = uniqLower(
      source?.permissions ??
        source?.perms ??
        root?.permissions ??
        root?.perms ??
        userObj?.permissions ??
        userObj?.perms ??
        []
    );

    const can =
      normalizeCan(source?.can) ||
      normalizeCan(root?.can) ||
      normalizeCan(userObj?.can) ||
      null;

    const normalized = {
      ...(root || {}),
      ...(userObj || {}),
      ...(source || {}),
      user: userObj || source?.user || null,
      email,
      roles,
      permissions,
      perms: permissions,
      can,
      superadmin:
        source?.superadmin === true ||
        source?.isSuperAdmin === true ||
        root?.superadmin === true ||
        root?.isSuperAdmin === true ||
        userObj?.superadmin === true ||
        userObj?.isSuperAdmin === true,
      isSuperAdmin:
        source?.isSuperAdmin === true ||
        source?.superadmin === true ||
        root?.isSuperAdmin === true ||
        root?.superadmin === true ||
        userObj?.isSuperAdmin === true ||
        userObj?.superadmin === true,
      visitor:
        source?.visitor === true ||
        source?.isVisitor === true ||
        root?.visitor === true ||
        root?.isVisitor === true ||
        userObj?.visitor === true ||
        userObj?.isVisitor === true,
      isVisitor:
        source?.isVisitor === true ||
        source?.visitor === true ||
        root?.isVisitor === true ||
        root?.visitor === true ||
        userObj?.isVisitor === true ||
        userObj?.visitor === true,
    };

    if (email && email === SUPERADMIN_EMAIL) {
      normalized.superadmin = true;
      normalized.isSuperAdmin = true;

      if (!normalized.can || typeof normalized.can !== "object") {
        normalized.can = {
          "nav.accesos": true,
          "nav.rondas": true,
          "nav.incidentes": true,
          "nav.visitas": true,
          "nav.bitacora": true,
          "nav.iam": true,
        };
      }
    }

    return normalized;
  }

  function isVisitorUser(meLike) {
    const email = normalizeEmail(meLike?.email || meLike?.user?.email || "");
    if (SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL) return false;

    const roles = uniqLower(
      meLike?.roles ??
        meLike?.user?.roles ??
        []
    );

    const isRoleVisitor = roles.some((r) => r === "visita" || r === "visitor");

    if (!!meLike?.visitor || !!meLike?.isVisitor || isRoleVisitor) return true;

    return readVisitorHint();
  }

  export default function Sidebar({ onNavigate, variant }) {
    const nav = useNavigate();
    const { isAuthenticated, isLoading, user, logout, token } = useAuth();

    // ✅ Fuente canónica para menú: /iam/v1/me
    const [meState, setMeState] = useState(null);
    const [meLoading, setMeLoading] = useState(false);

    useEffect(() => {
      let alive = true;

      async function loadMe() {
        const hardToken = getToken?.() || token || "";
        if (!hardToken) {
          if (!alive) return;
          setMeState(null);
          setMeLoading(false);
          return;
        }

        setMeLoading(true);

        try {
          const res = await api.get("/iam/v1/me", {
            headers: {
              "Cache-Control": "no-store, no-cache",
              Pragma: "no-cache",
            },
          });

          const payload = res?.data ?? null;
          const normalized = normalizeMePayload(payload);

          if (!alive) return;
          setMeState(normalized || null);

          // ✅ persistir para mantener sincronía con AuthProvider
          if (normalized) {
            try {
              localStorage.setItem(USER_KEY, JSON.stringify(normalized));
              window.dispatchEvent(new Event(USER_UPDATED_EVENT));
            } catch {
              // ignore
            }
          }
        } catch {
          if (!alive) return;
          setMeState(null);
        } finally {
          if (!alive) return;
          setMeLoading(false);
        }
      }

      loadMe();

      const onTokenUpdated = () => loadMe();
      const onUserUpdated = () => loadMe();
      const onFocus = () => loadMe();

      window.addEventListener(TOKEN_UPDATED_EVENT, onTokenUpdated);
      window.addEventListener(USER_UPDATED_EVENT, onUserUpdated);
      window.addEventListener("focus", onFocus);

      return () => {
        alive = false;
        window.removeEventListener(TOKEN_UPDATED_EVENT, onTokenUpdated);
        window.removeEventListener(USER_UPDATED_EVENT, onUserUpdated);
        window.removeEventListener("focus", onFocus);
      };
    }, [token]);

    const effectiveMe = useMemo(() => {
      if (meState && typeof meState === "object") return meState;
      if (user && typeof user === "object") return normalizeMePayload(user);
      return null;
    }, [meState, user]);

    const handleLogoutClick = async () => {
      onNavigate?.();

      try {
        await logout?.();
      } catch {
        // ignore
      }

      try {
        clearToken();
        localStorage.removeItem("token");
        localStorage.removeItem("access_token");
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(VISITOR_HINT_KEY);
        sessionStorage.removeItem(RETURN_TO_KEY);
      } catch {
        // ignore
      }

      nav(ROUTE_LOGIN, { replace: true });
    };

    const isVisitor = useMemo(() => isVisitorUser(effectiveMe), [effectiveMe]);
    const allowlistKey = useMemo(() => NAV_KEYS_ALLOWLIST.join(","), []);

    const sessionSections = useMemo(() => {
      const secs = getNavSectionsForMe(effectiveMe) || [];

      const filteredByAllowlist =
        NAV_KEYS_ALLOWLIST.length > 0
          ? secs.filter((x) => NAV_KEYS_ALLOWLIST.includes(String(x.key || "").trim()))
          : secs;

      const filteredByVisitor = isVisitor
        ? filteredByAllowlist.filter((x) => String(x.path || "").startsWith("/visitas"))
        : filteredByAllowlist;

      return Array.isArray(filteredByVisitor) ? filteredByVisitor : [];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveMe, isVisitor, allowlistKey]);

    const homeItem = useMemo(() => {
      if (isVisitor) return null;
      return {
        key: "home",
        label: "Director del panel",
        path: "/",
        icon: Home,
        emphasizeDark: true,
      };
    }, [isVisitor]);

    const items = useMemo(() => {
      const base = [];
      if (homeItem) base.push(homeItem);

      base.push(
        ...sessionSections.map((s) => ({
          key: s.key,
          label: s.label,
          path: s.path,
          icon: s.icon,
          emphasizeDark: false,
        }))
      );

      return base;
    }, [homeItem, sessionSections]);

    const showNav =
      !isLoading &&
      !meLoading &&
      (!isAuthenticated || (effectiveMe && typeof effectiveMe === "object"));

    return (
      <div
        className="flex h-full w-full flex-col overflow-y-auto overscroll-contain p-4"
        aria-label={variant === "mobile" ? "Barra lateral (móvil)" : "Barra lateral"}
        style={{
          background: "transparent",
          color: "var(--text)",
        }}
      >
        <div className="mb-6 px-2">
          <div
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            SENAF
          </div>
          <div
            className="mt-1 text-xs font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Plataforma de seguridad
          </div>
        </div>

        {showNav ? (
          <nav className="flex flex-col gap-1.5 text-[15px]">
            {items.map(({ key, path, label, icon: Icon, emphasizeDark }) => (
              <NavItem
                key={key || path}
                to={path}
                label={label}
                Icon={Icon}
                onClick={onNavigate}
                emphasizeDark={emphasizeDark}
              />
            ))}
          </nav>
        ) : (
          <div className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Cargando sesión…
          </div>
        )}

        <div className="mt-auto pt-6">
          <div className="mb-3" style={{ borderTop: "1px solid var(--border)" }} />

          {isAuthenticated && (
            <button
              type="button"
              onClick={handleLogoutClick}
              title="Cerrar sesión"
              className="group flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left transition-all duration-150 hover:translate-x-[1px]"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
                boxShadow: "var(--shadow-sm)",
                color: "var(--text)",
              }}
            >
              <LogOut
                className="h-5 w-5"
                strokeWidth={2.4}
                style={{ color: "var(--text-muted)" }}
              />
              <span className="text-[15px] font-medium leading-none">Salir</span>
            </button>
          )}
        </div>
      </div>
    );
  }