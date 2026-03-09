// client/src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LogOut } from "lucide-react";

import { useAuth } from "../pages/auth/AuthProvider.jsx";
import api, { clearToken, getToken } from "../lib/api.js";
import { getNavSectionsForMe } from "../config/navConfig.js";

const ROUTE_LOGIN = String(import.meta.env.VITE_ROUTE_LOGIN || "/login").trim() || "/login";

const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";
const VISITOR_HINT_KEY = "senaf_is_visitor";

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
    "group relative block rounded-2xl transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]";

  const inactive = "hover:bg-white/40 dark:hover:bg-white/10";
  const activeCls =
    "bg-white/55 dark:bg-white/12 ring-1 ring-neutral-200/70 dark:ring-white/10";

  const emphasizeCls = emphasizeDark ? "dark:bg-white/10 dark:ring-white/12" : "";

  return (
    <NavLink
      to={to}
      onClick={(e) => onClick?.(e)}
      className={[base, active ? activeCls : inactive, emphasizeCls]
        .filter(Boolean)
        .join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {Icon ? (
          <Icon className="w-6 h-6 shrink-0 text-neutral-800 dark:text-white" strokeWidth={2} />
        ) : (
          <span className="w-6 h-6 shrink-0" />
        )}
        <span className="text-[16px] leading-none text-neutral-900 dark:text-white">{label}</span>
      </div>
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

function normalizeMePayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const root = payload;
  const userObj = payload.user && typeof payload.user === "object" ? payload.user : null;
  const meObj = payload.me && typeof payload.me === "object" ? payload.me : null;

  const source = meObj || root;

  const email =
    normalizeEmail(source?.email) ||
    normalizeEmail(userObj?.email) ||
    normalizeEmail(root?.email) ||
    "";

  const roles = Array.isArray(source?.roles)
    ? source.roles
    : Array.isArray(root?.roles)
    ? root.roles
    : Array.isArray(userObj?.roles)
    ? userObj.roles
    : [];

  const permissions = Array.isArray(source?.permissions)
    ? source.permissions
    : Array.isArray(source?.perms)
    ? source.perms
    : Array.isArray(root?.permissions)
    ? root.permissions
    : Array.isArray(root?.perms)
    ? root.perms
    : Array.isArray(userObj?.permissions)
    ? userObj.permissions
    : Array.isArray(userObj?.perms)
    ? userObj.perms
    : [];

  const can =
    (source?.can && typeof source.can === "object" && source.can) ||
    (root?.can && typeof root.can === "object" && root.can) ||
    (userObj?.can && typeof userObj.can === "object" && userObj.can) ||
    null;

  const normalized = {
    ...(userObj || {}),
    ...(root || {}),
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

  const roles = Array.isArray(meLike?.roles)
    ? meLike.roles
    : Array.isArray(meLike?.user?.roles)
    ? meLike.user.roles
    : [];

  const isRoleVisitor = roles.some((r) => {
    const x = String(r || "").toLowerCase().trim();
    return x === "visita" || x === "visitor";
  });

  if (!!meLike?.visitor || !!meLike?.isVisitor || isRoleVisitor) return true;

  return readVisitorHint();
}

export default function Sidebar({ onNavigate, variant }) {
  const nav = useNavigate();
  const { isAuthenticated, isLoading, user, me, logout } = useAuth();

  // ✅ Fuente canónica para menú: /iam/v1/me (incluye can + routeRules)
  const [meState, setMeState] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const hardToken = getToken?.() || "";
      if (!hardToken) {
        if (!alive) return;
        setMeState(null);
        setMeLoading(false);
        return;
      }

      setMeLoading(true);
      try {
        const res = await api.get("/iam/v1/me", {
          headers: { "Cache-Control": "no-store, no-cache", Pragma: "no-cache" },
        });

        const payload = res?.data ?? null;
        const normalized = normalizeMePayload(payload);

        if (!alive) return;
        setMeState(normalized || null);
      } catch {
        if (!alive) return;
        setMeState(null);
      } finally {
        if (!alive) return;
        setMeLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const effectiveMe = useMemo(() => {
    if (meState && typeof meState === "object") return meState;
    if (me && typeof me === "object") return normalizeMePayload(me);
    if (user && typeof user === "object") return normalizeMePayload(user);
    return null;
  }, [meState, me, user]);

  const handleLogoutClick = async () => {
    onNavigate?.();

    try {
      await logout?.();
    } catch {}

    try {
      clearToken();
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");

      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(VISITOR_HINT_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {}

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
      className={[
        "w-full h-full flex flex-col overflow-y-auto overscroll-contain p-4",
        "bg-white/55 dark:bg-neutral-950/45 backdrop-blur-2xl",
        "border-r border-neutral-200/60 dark:border-white/10",
      ].join(" ")}
      aria-label={variant === "mobile" ? "Barra lateral (móvil)" : "Barra lateral"}
    >
      <div className="text-2xl font-extrabold mb-6 tracking-tight">SENAF</div>

      {showNav ? (
        <nav className="flex flex-col gap-1 text-[15px]">
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
        <div className="text-sm text-neutral-600 dark:text-neutral-300 px-2">Cargando sesión…</div>
      )}

      <div className="mt-auto pt-6">
        <div className="border-t border-white/10 mb-3" />

        {isAuthenticated && (
          <button
            type="button"
            onClick={handleLogoutClick}
            title="Cerrar sesión"
            className={[
              "group w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition",
              "border border-neutral-200/60 dark:border-white/10",
              "bg-white/55 dark:bg-neutral-950/35 backdrop-blur-xl shadow-sm",
              "hover:bg-white/70 dark:hover:bg-neutral-900/45",
            ].join(" ")}
          >
            <LogOut className="w-5 h-5 text-neutral-900 dark:text-white" strokeWidth={2.5} />
            <span className="font-medium">Salir</span>
          </button>
        )}
      </div>
    </div>
  );
}