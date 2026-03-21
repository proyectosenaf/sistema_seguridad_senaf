import React from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import ThemeFxPicker from "./ThemeFxPicker.jsx";
import { useAuth } from "../pages/auth/AuthProvider.jsx";
import { getNavSectionsForMe } from "../config/navConfig.js";
import { clearToken } from "../lib/api.js";
import {
  Menu,
  LogOut,
  Search,
  Bell,
  Plus,
  X,
  ArrowLeft,
} from "lucide-react";

import { socket } from "../lib/socket.js";
import NotificationsAPI from "../lib/notificationsApi.js";

/* -------------------------
   Helpers
------------------------- */
function clampMenuX(left, menuWidth, gap = 8) {
  const vw = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth || 0
  );
  const min = gap;
  const max = vw - menuWidth - gap;
  return Math.min(max, Math.max(min, left));
}

function useDismissOnOutside(open, refs, onClose) {
  React.useEffect(() => {
    if (!open) return;

    function handler(e) {
      const inside = refs.some(
        (r) => r.current && r.current.contains(e.target)
      );
      if (!inside) onClose();
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, refs, onClose]);
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function getVisitorHint() {
  try {
    return localStorage.getItem("senaf_is_visitor") === "1";
  } catch {
    return false;
  }
}

function clearVisitorSessionSafe() {
  try {
    clearToken();
  } catch {}
  try {
    localStorage.removeItem("senaf_user");
  } catch {}
  try {
    localStorage.removeItem("senaf_otp_email");
  } catch {}
  try {
    localStorage.removeItem("senaf_is_visitor");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_flow");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_pwreset_token");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_mustChange");
  } catch {}
  try {
    sessionStorage.removeItem("auth:returnTo");
  } catch {}
}

function resolvePrincipal(auth) {
  const raw = auth?.me || auth?.user || null;
  if (!raw || typeof raw !== "object") return null;

  const email =
    normalizeEmail(raw.email) ||
    normalizeEmail(raw.user?.email) ||
    normalizeEmail(raw.profile?.email) ||
    "";

  if (email === "proyectosenaf@gmail.com") {
    return {
      ...raw,
      email,
      superadmin: true,
      isSuperAdmin: true,
      can:
        raw.can && typeof raw.can === "object"
          ? raw.can
          : {
              "nav.accesos": true,
              "nav.rondas": true,
              "nav.incidentes": true,
              "nav.visitas": true,
              "nav.bitacora": true,
              "nav.iam": true,
            },
    };
  }

  return raw;
}

/* -------------------------
   PATH labels
------------------------- */
function getPathLabel(pathname) {
  const p = String(pathname || "/");

  if (p === "/") return "Panel principal";
  if (p.startsWith("/accesos")) return "Control de Acceso";
  if (p.startsWith("/rondasqr") || p.startsWith("/rondas")) {
    return "Rondas de Vigilancia";
  }
  if (p.startsWith("/incidentes")) return "Gestión de Incidentes";
  if (p.startsWith("/visitas")) return "Control de Visitas";
  if (p.startsWith("/bitacora")) return "Bitácora Digital";
  if (p.startsWith("/iam")) return "Usuarios y Permisos";

  return p.replaceAll("/", "");
}

/* ---------- Breadcrumbs ---------- */
function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [
    "/",
    ...parts.map((_, i) => `/${parts.slice(0, i + 1).join("/")}`),
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden lg:flex items-center gap-2 text-sm"
      style={{ color: "var(--text-muted)" }}
    >
      {crumbs.map((p, i) => {
        const label = getPathLabel(p);
        const last = i === crumbs.length - 1;

        return (
          <span key={p} className="flex items-center gap-2">
            {i > 0 && <span style={{ opacity: 0.45 }}>›</span>}

            {last ? (
              <span
                className="font-medium"
                style={{ color: "var(--text)", opacity: 0.92 }}
              >
                {label}
              </span>
            ) : (
              <Link
                to={p}
                className="transition-opacity hover:underline"
                style={{ color: "var(--text-muted)", opacity: 0.92 }}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* =========
   UI tokens
   ========= */
const fxBtn =
  "inline-flex items-center justify-center rounded-[16px] p-2 transition-all duration-150";

const fxBtnText =
  "inline-flex items-center gap-2 rounded-[16px] px-3 py-2 transition-all duration-150";

const fxPopover = "fixed z-[70] w-80 rounded-[20px] p-1";
const fxModal = "mx-auto w-[min(680px,92vw)] rounded-[20px] p-4";

function controlStyle() {
  return {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
  };
}

function controlHoverStyle() {
  return {
    background: "color-mix(in srgb, var(--panel) 76%, transparent)",
    border: "1px solid var(--border-strong)",
  };
}

function popoverStyle() {
  return {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--card) 92%, transparent)",
    color: "var(--text)",
    boxShadow: "var(--shadow-lg)",
    backdropFilter: "blur(16px) saturate(135%)",
    WebkitBackdropFilter: "blur(16px) saturate(135%)",
  };
}

function softBadgeStyle() {
  return {
    background: "color-mix(in srgb, var(--panel) 75%, transparent)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };
}

export default function Topbar({ onToggleMenu, showBack = false, back = null }) {
  const auth = useAuth();
  const { user, logout, isAuthenticated } = auth;
  const principal = React.useMemo(() => resolvePrincipal(auth), [auth]);

  const nav = useNavigate();
  const { pathname } = useLocation();

  const isVisitor = React.useMemo(() => {
    const hint = getVisitorHint();
    const me = auth?.me || auth?.user || null;
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    const byRole = roles
      .map((r) => String(r || "").toLowerCase())
      .includes("visita");
    return hint || byRole;
  }, [auth]);

  const modules = React.useMemo(() => {
    const secs = getNavSectionsForMe(principal) || [];
    const order = [
      "accesos",
      "rondas",
      "incidentes",
      "visitas",
      "bitacora",
      "iam",
    ];

    const rank = (k) => {
      const i = order.indexOf(k);
      return i === -1 ? 999 : i;
    };

    return [...secs].sort((a, b) => rank(a.key) - rank(b.key));
  }, [principal]);

  const [q, setQ] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (isVisitor) return;

    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVisitor]);

  function runSearch() {
    const base = pathname.startsWith("/visitas")
      ? "/visitas"
      : pathname.startsWith("/bitacora")
      ? "/bitacora"
      : pathname.startsWith("/rondas")
      ? "/rondas"
      : pathname.startsWith("/accesos")
      ? "/accesos"
      : "/incidentes";

    if (q.trim()) nav(`${base}?q=${encodeURIComponent(q.trim())}`);
    else nav(base);

    setSearchOpen(false);
  }

  function goBack() {
    if (back?.onClick) return back.onClick();
    nav("/");
  }

  const quickBtnRef = React.useRef(null);
  const quickMenuRef = React.useRef(null);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickPos, setQuickPos] = React.useState({ left: 0, top: 0 });

  React.useEffect(() => {
    if (isVisitor || !quickOpen) return;

    const recalc = () => {
      if (!quickBtnRef.current) return;
      const r = quickBtnRef.current.getBoundingClientRect();
      const menuW = 320;
      const gap = 8;
      setQuickPos({
        left: clampMenuX(r.left, menuW, gap),
        top: r.bottom + gap,
      });
    };

    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    recalc();

    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [quickOpen, isVisitor]);

  useDismissOnOutside(quickOpen, [quickBtnRef, quickMenuRef], () =>
    setQuickOpen(false)
  );

  const toggleQuick = () => {
    if (isVisitor) return;

    setQuickOpen((next) => {
      const willOpen = !next;

      if (willOpen && quickBtnRef.current) {
        const r = quickBtnRef.current.getBoundingClientRect();
        const menuW = 320;
        const gap = 8;
        setQuickPos({
          left: clampMenuX(r.left, menuW, gap),
          top: r.bottom + gap,
        });
      }

      return willOpen;
    });
  };

  const bellBtnRef = React.useRef(null);
  const [bellOpen, setBellOpen] = React.useState(false);
  const [bellPos, setBellPos] = React.useState({ left: 0, top: 0 });

  const [counts, setCounts] = React.useState({
    unread: 0,
    alerts: 0,
    total: 0,
  });

  const hasNew = (counts?.unread || 0) > 0 || (counts?.alerts || 0) > 0;

  const fetchCounts = React.useCallback(async () => {
    if (isVisitor) return;

    try {
      const n = await NotificationsAPI.getCount();
      setCounts({ unread: Number(n || 0), alerts: 0, total: Number(n || 0) });
    } catch {
      // silent
    }
  }, [isVisitor]);

  const clearCounts = React.useCallback(async () => {
    try {
      await NotificationsAPI.markAllRead();
      await fetchCounts();
    } catch {
      // silent
    }
  }, [fetchCounts]);

  React.useEffect(() => {
    if (isVisitor) return;

    fetchCounts();
    if (!socket) return;

    const update = () => fetchCounts();

    socket.on("notifications:count-updated", update);
    socket.on("email:new", update);
    socket.on("message:new", update);
    socket.on("appointment:new", update);

    return () => {
      socket.off("notifications:count-updated", update);
      socket.off("email:new", update);
      socket.off("message:new", update);
      socket.off("appointment:new", update);
    };
  }, [fetchCounts, isVisitor]);

  React.useEffect(() => {
    if (!bellOpen || !bellBtnRef.current) return;

    const recalc = () => {
      if (!bellBtnRef.current) return;
      const r = bellBtnRef.current.getBoundingClientRect();
      const menuW = 320;
      const gap = 8;
      setBellPos({
        left: clampMenuX(r.left, menuW, gap),
        top: r.bottom + gap,
      });
    };

    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    recalc();

    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [bellOpen]);

  function handleExit() {
    try {
      logout?.();
    } catch {}

    clearVisitorSessionSafe();
    nav("/login", { replace: true });
  }

  return (
    <div className="flex h-14 items-center gap-3 px-4 md:px-6">
      <button
        type="button"
        onClick={onToggleMenu}
        className={"md:hidden " + fxBtn}
        aria-label="Abrir menú"
        style={controlStyle()}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, controlHoverStyle())}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, controlStyle())}
      >
        <Menu className="h-5 w-5" />
      </button>

      {showBack && (
        <button
          type="button"
          onClick={goBack}
          className={fxBtnText}
          title={back?.label || "Regresar"}
          style={controlStyle()}
          onMouseEnter={(e) =>
            Object.assign(e.currentTarget.style, controlHoverStyle())
          }
          onMouseLeave={(e) =>
            Object.assign(e.currentTarget.style, controlStyle())
          }
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{back?.label || "Regresar"}</span>
        </button>
      )}

      {!isVisitor && <Breadcrumbs />}
      <div className="flex-1" />

      {!isVisitor && (
        <div className="hidden md:flex items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Buscar… (Ctrl/⌘+K)"
              className="input-fx w-64 pl-9 pr-9 py-2"
              style={{
                borderColor: "var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--text)",
              }}
            />
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--text-muted)", opacity: 0.75 }}
            />
            {q && (
              <button
                className="absolute right-2 top-1/2 rounded-lg p-1 -translate-y-1/2 transition"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setQ("")}
                aria-label="Limpiar"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {!isVisitor && (
        <TopbarQuickMenu
          nav={nav}
          open={quickOpen}
          toggle={toggleQuick}
          btnRef={quickBtnRef}
          menuRef={quickMenuRef}
          pos={quickPos}
          fxBtn={fxBtn}
          modules={modules}
        />
      )}

      {!isVisitor && (
        <div ref={bellBtnRef} className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((v) => !v)}
            className={"relative " + fxBtn}
            aria-label="Notificaciones"
            aria-haspopup="menu"
            aria-expanded={bellOpen}
            style={controlStyle()}
            onMouseEnter={(e) =>
              Object.assign(e.currentTarget.style, controlHoverStyle())
            }
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, controlStyle())
            }
          >
            <Bell
              className="h-5 w-5"
              style={{ color: hasNew ? "#e11d48" : "var(--text)" }}
            />
            {hasNew && (
              <span
                className="absolute -right-0.5 -top-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center"
                style={{
                  background: "#e11d48",
                  color: "#fff",
                  boxShadow: "0 0 0 2px rgba(255,255,255,.75)",
                }}
              >
                {Math.min((counts.unread || 0) + (counts.alerts || 0), 99)}
              </span>
            )}
          </button>

          {bellOpen && (
            <BellMenu
              anchorRef={bellBtnRef}
              counts={counts}
              onClear={() => {
                clearCounts();
                setBellOpen(false);
              }}
              onClose={() => setBellOpen(false)}
              setPosFn={setBellPos}
              pos={bellPos}
            />
          )}
        </div>
      )}

      <div className="sm:hidden flex items-center gap-2 shrink-0">
        <div className="shrink-0">
          <ThemeFxPicker />
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <div className="shrink-0">
          <ThemeFxPicker />
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>

        <span
          className="hidden sm:block text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {user?.name ||
            user?.fullName ||
            user?.email ||
            (isVisitor ? "Visitante" : "")}
        </span>

        {(isAuthenticated || isVisitor) && (
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex items-center gap-2 rounded-[16px] px-3 py-2 text-sm font-medium transition-all duration-150"
            title="Salir"
            style={controlStyle()}
            onMouseEnter={(e) =>
              Object.assign(e.currentTarget.style, controlHoverStyle())
            }
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, controlStyle())
            }
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        )}
      </div>

      {searchOpen && !isVisitor && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{
            background: "rgba(2, 6, 23, 0.8)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className={fxModal}
            style={popoverStyle()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mb-2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Búsqueda global
            </div>

            <div className="relative">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                placeholder="Escribe y presiona Enter…"
                className="input-fx w-full pl-10 pr-10 py-3"
                style={{
                  borderColor: "var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              />
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--text-muted)", opacity: 0.75 }}
              />
              {q && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 rounded-lg p-1 -translate-y-1/2 transition"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => setQ("")}
                  aria-label="Limpiar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div
              className="mt-2 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Enter para buscar en el módulo actual · Esc para cerrar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function TopbarQuickMenu({ nav, open, toggle, btnRef, menuRef, pos, fxBtn, modules = [] }) {
  useDismissOnOutside(open, [btnRef, menuRef], () => {
    if (open) toggle();
  });

  return (
    <>
      <div ref={btnRef}>
        <button
          type="button"
          onClick={toggle}
          className={fxBtn}
          title="Abrir módulo"
          aria-haspopup="menu"
          aria-expanded={open}
          style={controlStyle()}
          onMouseEnter={(e) =>
            Object.assign(e.currentTarget.style, controlHoverStyle())
          }
          onMouseLeave={(e) =>
            Object.assign(e.currentTarget.style, controlStyle())
          }
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[70] w-80 rounded-[20px] p-1"
          style={{
            left: `${pos.left}px`,
            top: `${pos.top}px`,
            ...popoverStyle(),
          }}
          role="menu"
        >
          <div
            className="px-3 py-2 text-xs font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Abrir módulo
          </div>

          {!modules.length ? (
            <div
              className="px-3 py-3 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No hay módulos habilitados para tu usuario.
            </div>
          ) : (
            modules.map(({ path, label, icon: Icon, key }) => (
              <button
                key={key || path}
                type="button"
                onClick={() => {
                  nav(path);
                  toggle();
                }}
                className="w-full flex items-center gap-2 rounded-[14px] px-3 py-2 text-left transition-all duration-150"
                role="menuitem"
                style={{ color: "var(--text)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--panel) 70%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {Icon ? (
                  <Icon
                    className="h-4 w-4"
                    style={{ color: "var(--text-muted)" }}
                  />
                ) : null}
                <span>{label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}

function BellMenu({ anchorRef, counts, onClear, onClose, setPosFn, pos }) {
  React.useEffect(() => {
    if (!anchorRef.current) return;

    const recalc = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      const menuW = 320;
      const gap = 8;
      setPosFn({
        left: clampMenuX(r.left, menuW, gap),
        top: r.bottom + gap,
      });
    };

    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    recalc();

    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [anchorRef, setPosFn]);

  return (
    <div
      className="fixed z-[70] w-80 rounded-[20px] p-2"
      style={{
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        ...popoverStyle(),
      }}
      role="menu"
    >
      <div className="px-2 py-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Notificaciones
      </div>

      <div className="space-y-1 p-2 text-sm">
        <RowStat label="Sin leer" value={counts.unread || 0} />
        <RowStat label="Alertas" value={counts.alerts || 0} />
        <RowStat label="Total" value={counts.total || 0} />
      </div>

      <div className="flex gap-2 p-2 pt-1">
        <button
          type="button"
          onClick={onClear}
          className="flex-1 rounded-[14px] px-3 py-2 text-white transition"
          style={{
            background: "linear-gradient(135deg, #e11d48, #f43f5e)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          Marcar todo como leído
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[14px] px-3 py-2 transition"
          style={controlStyle()}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function RowStat({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className="rounded-lg px-2 py-0.5 text-xs"
        style={softBadgeStyle()}
      >
        {value}
      </span>
    </div>
  );
}