// client/src/components/Topbar.jsx
import React from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import ThemeFxPicker from "./ThemeFxPicker.jsx";
import { useAuth } from "./pages/auth/AuthProvider.jsx";
import {
  Menu,
  LogOut,
  Search,
  Bell,
  Plus,
  X,
  ArrowLeft,
  DoorOpen,
  Footprints,
  AlertTriangle,
  UsersRound,
  NotebookPen,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";



// ✅ usar el socket global (NO crear otro)
import { socket } from "../lib/socket.js";

// === API de notificaciones (stub seguro) ===
import NotificationsAPI from "../lib/notificationsApi.js";

/* -------------------------
   Helpers
------------------------- */
function clampMenuX(left, menuWidth, gap = 8) {
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const min = gap;
  const max = vw - menuWidth - gap;
  return Math.min(max, Math.max(min, left));
}

function useDismissOnOutside(open, refs, onClose) {
  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      const inside = refs.some((r) => r.current && r.current.contains(e.target));
      if (!inside) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, refs, onClose]);
}

/* -------------------------
   PATH labels (robusto)
------------------------- */
function getPathLabel(pathname) {
  const P = String(pathname || "/");

  if (P === "/") return "Panel principal";
  if (P.startsWith("/accesos")) return "Control de Acceso";
  if (P.startsWith("/rondasqr") || P.startsWith("/rondas")) return "Rondas de Vigilancia";
  if (P.startsWith("/incidentes")) return "Gestión de Incidentes";
  if (P.startsWith("/visitas")) return "Control de Visitas";
  if (P.startsWith("/bitacora")) return "Bitácora Digital";
  if (P.startsWith("/supervision")) return "Supervisión";
  if (P.startsWith("/iam")) return "Usuarios y Permisos";

  return P.replaceAll("/", "");
}

// ---------- Breadcrumbs ----------
function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = ["/", ...parts.map((_, i) => `/${parts.slice(0, i + 1).join("/")}`)];

  return (
    <nav aria-label="Breadcrumb" className="hidden lg:flex items-center gap-2 text-sm">
      {crumbs.map((p, i) => {
        const label = getPathLabel(p);
        const last = i === crumbs.length - 1;
        return (
          <span key={p} className="flex items-center gap-2">
            {i > 0 && <span className="opacity-40">›</span>}
            {last ? (
              <span className="font-medium opacity-80">{label}</span>
            ) : (
              <Link to={p} className="opacity-70 hover:opacity-100 hover:underline">
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
  "inline-flex items-center justify-center p-2 rounded-xl " +
  "border border-neutral-200/60 dark:border-white/10 " +
  "bg-white/55 dark:bg-neutral-950/40 " +
  "backdrop-blur-xl shadow-sm " +
  "hover:bg-white/70 dark:hover:bg-neutral-900/45 " +
  "transition";

const fxBtnText =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl " +
  "border border-neutral-200/60 dark:border-white/10 " +
  "bg-white/55 dark:bg-neutral-950/40 " +
  "backdrop-blur-xl shadow-sm " +
  "hover:bg-white/70 dark:hover:bg-neutral-900/45 " +
  "transition";

const fxPopover =
  "fixed z-[70] w-80 rounded-2xl " +
  "border border-neutral-200/60 dark:border-white/10 " +
  "bg-white/65 dark:bg-neutral-950/45 " +
  "backdrop-blur-2xl shadow-2xl p-1";

const fxModal =
  "w-[min(680px,92vw)] mx-auto rounded-2xl " +
  "border border-neutral-200/60 dark:border-white/10 " +
  "bg-white/70 dark:bg-neutral-950/50 " +
  "backdrop-blur-2xl shadow-2xl p-4";

/* -------------------------
   Íconos de módulos
------------------------- */
const IconDoor = DoorOpen;
const IconFootprints = Footprints;
const IconVisitors = UsersRound;
const IconEval = ClipboardCheck;
const IconIAM = ShieldCheck;

const MODULES = [
  { to: "/accesos", label: "Control de Acceso", Icon: IconDoor },

  // ✅ canónico: abrir directo scan
  { to: "/rondasqr/scan", label: "Rondas de Vigilancia", Icon: IconFootprints },

  { to: "/incidentes", label: "Gestión de Incidentes", Icon: AlertTriangle },
  { to: "/visitas", label: "Control de Visitas", Icon: IconVisitors },
  { to: "/bitacora", label: "Bitácora Digital", Icon: NotebookPen },
  { to: "/supervision", label: "Supervisión", Icon: ClipboardList },
  { to: "/iam/admin", label: "Usuarios y Permisos", Icon: IconIAM },
];

export default function Topbar({ onToggleMenu, showBack = false, back = null }) {
  const { user, logout, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  // -------- búsqueda --------
  const [q, setQ] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function runSearch() {
    const base = pathname.startsWith("/visitas")
      ? "/visitas"
      : pathname.startsWith("/supervision")
      ? "/supervision"
      : pathname.startsWith("/bitacora")
      ? "/bitacora"
      : "/incidentes";

    if (q.trim()) nav(`${base}?q=${encodeURIComponent(q.trim())}`);
    else nav(base);

    setSearchOpen(false);
  }

  // ✅ Back soporta callback del Layout
  function goBack() {
    if (back?.onClick) return back.onClick();
    nav("/");
  }

  // -------- menú + --------
  const quickBtnRef = React.useRef(null);
  const quickMenuRef = React.useRef(null);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickPos, setQuickPos] = React.useState({ left: 0, top: 0 });

  React.useEffect(() => {
    if (!quickOpen) return;
    const recalc = () => {
      if (!quickBtnRef.current) return;
      const r = quickBtnRef.current.getBoundingClientRect();
      const menuW = 320;
      const gap = 8;
      setQuickPos({ left: clampMenuX(r.left, menuW, gap), top: r.bottom + gap });
    };
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    recalc();
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [quickOpen]);

  useDismissOnOutside(quickOpen, [quickBtnRef, quickMenuRef], () => setQuickOpen(false));

  const toggleQuick = () => {
    setQuickOpen((next) => {
      const willOpen = !next;
      if (willOpen && quickBtnRef.current) {
        const r = quickBtnRef.current.getBoundingClientRect();
        const menuW = 320;
        const gap = 8;
        setQuickPos({ left: clampMenuX(r.left, menuW, gap), top: r.bottom + gap });
      }
      return willOpen;
    });
  };

  // -------- campana (notificaciones) --------
  const bellBtnRef = React.useRef(null);
  const [bellOpen, setBellOpen] = React.useState(false);
  const [bellPos, setBellPos] = React.useState({ left: 0, top: 0 });

  const [counts, setCounts] = React.useState({ unread: 0, alerts: 0, total: 0 });
  const hasNew = (counts?.unread || 0) > 0 || (counts?.alerts || 0) > 0;

  const fetchCounts = React.useCallback(async () => {
    try {
      const n = await NotificationsAPI.getCount();
      setCounts({ unread: Number(n || 0), alerts: 0, total: Number(n || 0) });
    } catch {
      // silent
    }
  }, []);

  const clearCounts = React.useCallback(async () => {
    try {
      await NotificationsAPI.markAllRead();
      await fetchCounts();
    } catch {
      // silent
    }
  }, [fetchCounts]);

  React.useEffect(() => {
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
  }, [fetchCounts]);

  return (
    <div className="flex items-center gap-3 px-4 md:px-6 h-14">
      {/* Hamburguesa móvil */}
      <button
        type="button"
        onClick={onToggleMenu}
        className={"md:hidden " + fxBtn}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Regresar (opcional) */}
      {showBack && (
        <button
          type="button"
          onClick={goBack}
          className={fxBtnText}
          title={back?.label || "Regresar"}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{back?.label || "Regresar"}</span>
        </button>
      )}

      <Breadcrumbs />
      <div className="flex-1" />

      {/* Búsqueda rápida (desktop) */}
      <div className="hidden md:flex items-center gap-2">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Buscar… (Ctrl/⌘+K)"
            className="input-fx w-64 pl-9 pr-9 py-2"
          />
          <Search className="w-4 h-4 opacity-60 absolute left-3 top-1/2 -translate-y-1/2" />
          {q && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/40 dark:hover:bg-white/10"
              onClick={() => setQ("")}
              aria-label="Limpiar"
            >
              <X className="w-4 h-4 opacity-60" />
            </button>
          )}
        </div>
      </div>

      {/* Botón + */}
      <TopbarQuickMenu
        nav={nav}
        open={quickOpen}
        toggle={toggleQuick}
        btnRef={quickBtnRef}
        menuRef={quickMenuRef}
        pos={quickPos}
        fxBtn={fxBtn}
        fxPopover={fxPopover}
      />

      {/* Campana */}
      <div ref={bellBtnRef} className="relative">
        <button
          onClick={() => setBellOpen((v) => !v)}
          className={"relative " + fxBtn}
          aria-label="Notificaciones"
          aria-haspopup="menu"
          aria-expanded={bellOpen}
        >
          <Bell className={"w-5 h-5 " + (hasNew ? "text-rose-500" : "")} />
          {hasNew && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[18px] text-center ring-2 ring-white/80 dark:ring-neutral-950/80">
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
            fxPopover={fxPopover}
          />
        )}
      </div>

      {/* MÓVIL */}
      <div className="sm:hidden flex items-center gap-2 shrink-0">
        <div className="shrink-0">
          <ThemeFxPicker />
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>

      {/* ESCRITORIO */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <div className="shrink-0">
          <ThemeFxPicker />
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>

        <span className="hidden sm:block text-sm opacity-80">
          {user?.name || user?.fullName || user?.email || ""}
        </span>

        {isAuthenticated && (
          <button
            onClick={() => {
              try {
                logout?.();
              } finally {
                nav("/login", { replace: true });
              }
            }}
            className="btn-outline-neon inline-flex items-center gap-1"
            title="Salir"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        )}
      </div>

      {/* Modal búsqueda */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-start pt-24 bg-black/35"
          onClick={() => setSearchOpen(false)}
        >
          <div className={fxModal} onClick={(e) => e.stopPropagation()}>
            <div className="text-sm mb-2 opacity-70">Búsqueda global</div>
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
              />
              <Search className="w-4 h-4 opacity-60 absolute left-3 top-1/2 -translate-y-1/2" />
              {q && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/40 dark:hover:bg-white/10"
                  onClick={() => setQ("")}
                  aria-label="Limpiar"
                >
                  <X className="w-4 h-4 opacity-60" />
                </button>
              )}
            </div>
            <div className="text-xs opacity-60 mt-2">
              Enter para buscar en el módulo actual · Esc para cerrar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function TopbarQuickMenu({ nav, open, toggle, btnRef, menuRef, pos, fxBtn, fxPopover }) {
  useDismissOnOutside(open, [btnRef, menuRef], () => open && toggle());

  return (
    <>
      <div ref={btnRef}>
        <button
          onClick={toggle}
          className={fxBtn}
          title="Abrir módulo"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div
          ref={menuRef}
          className={fxPopover}
          style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
          role="menu"
        >
          <div className="px-3 py-2 text-xs font-semibold opacity-70">Abrir módulo</div>
          {MODULES.map(({ to, label, Icon }) => (
            <button
              key={to}
              onClick={() => {
                nav(to);
                toggle();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/40 dark:hover:bg-white/10 text-left"
              role="menuitem"
            >
              <Icon className="w-4 h-4 opacity-80" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function BellMenu({ anchorRef, counts, onClear, onClose, setPosFn, pos, fxPopover }) {
  React.useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const menuW = 320;
    const gap = 8;
    setPosFn({ left: clampMenuX(r.left, menuW, gap), top: r.bottom + gap });
  }, [anchorRef, setPosFn]);

  return (
    <div
      className={fxPopover + " p-2"}
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      role="menu"
    >
      <div className="px-2 py-1 text-sm opacity-70">Notificaciones</div>

      <div className="p-2 text-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="opacity-80">Sin leer</span>
          <span className="text-xs px-2 py-0.5 rounded-lg bg-white/40 dark:bg-white/10">
            {counts.unread || 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="opacity-80">Alertas</span>
          <span className="text-xs px-2 py-0.5 rounded-lg bg-white/40 dark:bg-white/10">
            {counts.alerts || 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="opacity-80">Total</span>
          <span className="text-xs px-2 py-0.5 rounded-lg bg-white/40 dark:bg-white/10">
            {counts.total || 0}
          </span>
        </div>
      </div>

      <div className="p-2 pt-1 flex gap-2">
        <button
          onClick={onClear}
          className="flex-1 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition"
        >
          Marcar todo como leído
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-xl border border-neutral-200/60 dark:border-white/10 bg-white/40 dark:bg-neutral-950/30 hover:bg-white/55 dark:hover:bg-neutral-900/40 transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
