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
  ExternalLink,
  CornerDownLeft,
  Clock3,
  Sparkles,
} from "lucide-react";

import { socket } from "../lib/socket.js";
import NotificationsAPI from "../lib/notificationsApi.js";

/* -------------------------
   Helpers base
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

function normalizeRoleName(role) {
  if (!role) return "";

  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function hasAdminAccess(principal) {
  if (!principal || typeof principal !== "object") return false;
  if (principal.superadmin || principal.isSuperAdmin) return true;

  const roles = Array.isArray(principal.roles) ? principal.roles : [];
  const normalized = roles.map(normalizeRoleName);

  return normalized.some((r) =>
    ["admin", "administrador", "superadmin", "super_admin"].includes(r)
  );
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

  return p.replaceAll("/", "") || "Ruta";
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

const fxModal = "mx-auto w-[min(820px,96vw)] rounded-[20px] p-4";

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

/* -------------------------
   Smart Search core
------------------------- */
const RECENT_SEARCHES_KEY = "senaf_recent_global_searches";
const MAX_RECENT_SEARCHES = 6;
const MAX_RESULTS = 12;

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(value) {
  return normalizeSearchText(value)
    .split(/[\s/_\-.:,;#?&=+()[\]{}]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isLikelyUrl(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s.startsWith("/")) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^(www\.)/i.test(s)) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return true;
  return false;
}

function toAbsoluteUrl(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("www.")) return `https://${s}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
  return s;
}

function isInternalProgramUrl(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s.startsWith("/")) return true;

  try {
    const absolute = toAbsoluteUrl(s);
    if (!/^https?:\/\//i.test(absolute)) return false;
    const u = new URL(absolute);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function internalPathFromValue(value) {
  const s = String(value || "").trim();
  if (!s) return "/";
  if (s.startsWith("/")) return s;

  try {
    const absolute = toAbsoluteUrl(s);
    const u = new URL(absolute);
    return `${u.pathname || "/"}${u.search || ""}${u.hash || ""}`;
  } catch {
    return "/";
  }
}

function readRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(next) {
  try {
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(
        (Array.isArray(next) ? next : []).slice(0, MAX_RECENT_SEARCHES)
      )
    );
  } catch {}
}

function pushRecentSearch(value) {
  const text = String(value || "").trim();
  if (!text) return;
  const prev = readRecentSearches();
  const next = [text, ...prev.filter((x) => x !== text)].slice(
    0,
    MAX_RECENT_SEARCHES
  );
  writeRecentSearches(next);
}

function dedupeEntries(entries) {
  const out = [];
  const seen = new Set();

  for (const item of Array.isArray(entries) ? entries : []) {
    const key = `${item.type || ""}::${item.path || ""}::${item.title || ""}::${
      item.actionKind || ""
    }`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function scoreItem(query, item) {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const tokens = tokenize(q);
  const title = normalizeSearchText(item.title);
  const desc = normalizeSearchText(item.description);
  const path = normalizeSearchText(item.path);
  const section = normalizeSearchText(item.section);
  const keywords = normalizeSearchText(
    Array.isArray(item.keywords) ? item.keywords.join(" ") : ""
  );
  const actionLabel = normalizeSearchText(item.actionLabel || "");
  const all = `${title} ${desc} ${path} ${section} ${keywords} ${actionLabel}`;

  let score = 0;

  if (title === q) score += 400;
  if (path === q) score += 320;
  if (actionLabel === q) score += 300;
  if (title.startsWith(q)) score += 220;
  if (actionLabel.startsWith(q)) score += 210;
  if (path.startsWith(q)) score += 200;
  if (keywords.includes(q)) score += 150;
  if (desc.includes(q)) score += 100;
  if (all.includes(q)) score += 70;

  for (const t of tokens) {
    if (!t) continue;
    if (title.startsWith(t)) score += 40;
    else if (title.includes(t)) score += 28;

    if (actionLabel.startsWith(t)) score += 35;
    else if (actionLabel.includes(t)) score += 24;

    if (keywords.includes(t)) score += 22;
    if (path.includes(t)) score += 18;
    if (desc.includes(t)) score += 14;
    if (section.includes(t)) score += 10;
  }

  return score;
}

function buildSearchResults(query, entries) {
  const q = String(query || "").trim();
  if (!q) return [];

  return dedupeEntries(
    (Array.isArray(entries) ? entries : [])
      .map((item) => ({ ...item, _score: scoreItem(q, item) }))
      .filter((item) => item._score > 0)
      .sort((a, b) => b._score - a._score)
  ).slice(0, MAX_RESULTS);
}

function getAllowedModuleKeys(modules) {
  return new Set(
    (Array.isArray(modules) ? modules : [])
      .map((m) => String(m.key || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

function getModuleAliases(key) {
  const map = {
    accesos: [
      "acceso",
      "control acceso",
      "entradas",
      "salidas",
      "empleados",
      "vehiculos",
      "vehículos",
      "placas",
      "personal",
    ],
    rondas: ["rondas", "ronda", "vigilancia", "guardia", "patrulla"],
    rondasqr: ["rondas qr", "qr", "escaneo qr", "puntos qr"],
    incidentes: ["incidentes", "alertas", "reportes", "riesgo"],
    visitas: ["visitas", "visitantes", "agenda", "citas", "recepcion", "qr visita"],
    bitacora: ["bitacora", "bitácora", "registro", "historial", "eventos"],
    iam: ["usuarios", "roles", "permisos", "iam", "seguridad"],
  };

  return map[String(key || "").toLowerCase()] || [];
}

function buildModuleSearchEntries(modules) {
  return (Array.isArray(modules) ? modules : []).map((m) => ({
    id: `module-${m.key || m.path}`,
    type: "module",
    title: String(m.label || m.title || "Módulo"),
    description: `Abrir ${String(m.label || m.title || "módulo")}`,
    keywords: [
      m.key,
      m.label,
      m.path,
      ...getModuleAliases(m.key),
      ...(Array.isArray(m.keywords) ? m.keywords : []),
    ].filter(Boolean),
    path: m.path || "/",
    section: "Módulos habilitados",
    moduleKey: String(m.key || "").toLowerCase(),
    icon: m.icon || null,
  }));
}

function getGlobalRouteEntries() {
  return [
    {
      id: "home",
      type: "route",
      title: "Panel principal",
      description: "Inicio del sistema SENAF",
      keywords: ["inicio", "panel", "dashboard", "home", "principal"],
      path: "/",
      section: "Global",
    },

    {
      id: "accesos-main",
      type: "route",
      title: "Control de Acceso",
      description: "Entradas, salidas, personal y vehículos",
      keywords: ["acceso", "entrada", "salida", "empleados", "vehiculos", "vehículos"],
      path: "/accesos",
      section: "Control de Acceso",
      moduleKey: "accesos",
    },
    {
      id: "accesos-empleados",
      type: "route",
      title: "Empleados",
      description: "Listado de empleados",
      keywords: ["empleados", "personal", "colaboradores", "lista empleados"],
      path: "/accesos",
      section: "Control de Acceso",
      moduleKey: "accesos",
    },
    {
      id: "accesos-vehiculos",
      type: "route",
      title: "Vehículos",
      description: "Listado y control vehicular",
      keywords: ["vehiculos", "vehículos", "placas", "autos", "carros"],
      path: "/accesos",
      section: "Control de Acceso",
      moduleKey: "accesos",
    },

    {
      id: "rondas-main",
      type: "route",
      title: "Rondas de Vigilancia",
      description: "Patrullaje y recorridos",
      keywords: ["rondas", "guardia", "patrulla", "vigilancia"],
      path: "/rondas",
      section: "Rondas",
      moduleKey: "rondas",
    },
    {
      id: "rondas-qr",
      type: "route",
      title: "Rondas QR",
      description: "Escaneo y control de puntos QR",
      keywords: ["rondas qr", "qr", "escaneo", "puntos qr"],
      path: "/rondasqr",
      section: "Rondas",
      moduleKey: "rondas",
    },

    {
      id: "incidentes-main",
      type: "route",
      title: "Gestión de Incidentes",
      description: "Incidentes, alertas y reportes",
      keywords: ["incidentes", "alertas", "reportes", "riesgo", "seguridad"],
      path: "/incidentes",
      section: "Incidentes",
      moduleKey: "incidentes",
    },

    {
      id: "visitas-main",
      type: "route",
      title: "Control de Visitas",
      description: "Visitantes, agenda y autorizaciones",
      keywords: ["visitas", "visitantes", "agenda", "citas", "recepcion", "recepción"],
      path: "/visitas",
      section: "Visitas",
      moduleKey: "visitas",
    },
    {
      id: "visitas-agenda",
      type: "route",
      title: "Agenda de Citas",
      description: "Programación de visitas",
      keywords: ["agenda", "citas", "programar visita", "agenda citas"],
      path: "/visitas/agenda",
      section: "Visitas",
      moduleKey: "visitas",
    },

    {
      id: "bitacora-main",
      type: "route",
      title: "Bitácora Digital",
      description: "Registro histórico y seguimiento",
      keywords: ["bitacora", "bitácora", "registro", "historial", "seguimiento"],
      path: "/bitacora",
      section: "Bitácora",
      moduleKey: "bitacora",
    },

    {
      id: "iam-main",
      type: "route",
      title: "Usuarios y Permisos",
      description: "Gestión de usuarios, roles y permisos",
      keywords: ["iam", "usuarios", "roles", "permisos", "seguridad"],
      path: "/iam",
      section: "IAM",
      moduleKey: "iam",
    },
  ];
}

function buildModuleActionEntries(modules) {
  const allowed = Array.isArray(modules) ? modules : [];

  const catalog = {
    accesos: [
      {
        title: "Nuevo Empleado",
        description: "Crear registro de empleado",
        path: "/accesos?action=create-employee",
        actionKind: "internal-route",
        actionLabel: "crear empleado",
        keywords: [
          "crear empleado",
          "nuevo empleado",
          "registrar empleado",
          "agregar empleado",
          "alta empleado",
        ],
      },
      {
        title: "Nuevo Vehículo",
        description: "Crear registro de vehículo",
        path: "/accesos?action=create-vehicle",
        actionKind: "internal-route",
        actionLabel: "crear vehiculo",
        keywords: [
          "crear vehiculo",
          "crear vehículo",
          "nuevo vehiculo",
          "nuevo vehículo",
          "registrar vehiculo",
          "agregar vehiculo",
        ],
      },
      {
        title: "Buscar Empleado",
        description: "Ir al listado de empleados",
        path: "/accesos",
        actionKind: "internal-route",
        actionLabel: "buscar empleado",
        keywords: [
          "empleados",
          "listar empleados",
          "ver empleados",
          "buscar empleados",
        ],
      },
      {
        title: "Buscar Vehículo",
        description: "Ir al listado de vehículos",
        path: "/accesos",
        actionKind: "internal-route",
        actionLabel: "buscar vehiculo",
        keywords: [
          "vehiculos",
          "vehículos",
          "listar vehiculos",
          "ver vehiculos",
          "buscar vehiculo",
          "placas",
        ],
      },
    ],

    rondas: [
      {
        title: "Ver Rondas",
        description: "Abrir recorridos y rondas",
        path: "/rondas",
        actionKind: "internal-route",
        actionLabel: "ver rondas",
        keywords: ["rondas", "listar rondas", "patrullas", "guardias"],
      },
      {
        title: "Escanear QR",
        description: "Abrir módulo de rondas QR",
        path: "/rondasqr",
        actionKind: "internal-route",
        actionLabel: "escanear qr",
        keywords: ["qr", "rondas qr", "escanear qr", "puntos qr"],
      },
    ],

    incidentes: [
      {
        title: "Nuevo Incidente",
        description: "Registrar incidente",
        path: "/incidentes?action=create",
        actionKind: "internal-route",
        actionLabel: "crear incidente",
        keywords: [
          "crear incidente",
          "nuevo incidente",
          "registrar incidente",
          "agregar incidente",
          "reportar incidente",
        ],
      },
      {
        title: "Ver Incidentes",
        description: "Ir al listado de incidentes",
        path: "/incidentes",
        actionKind: "internal-route",
        actionLabel: "ver incidentes",
        keywords: ["listar incidentes", "ver incidentes", "alertas", "reportes"],
      },
    ],

    visitas: [
      {
        title: "Nueva Visita",
        description: "Registrar visitante o visita",
        path: "/visitas?action=create",
        actionKind: "internal-route",
        actionLabel: "crear visita",
        keywords: [
          "crear visita",
          "nueva visita",
          "registrar visita",
          "agregar visita",
          "nuevo visitante",
          "registrar visitante",
        ],
      },
      {
        title: "Agenda de Citas",
        description: "Abrir agenda de visitas",
        path: "/visitas/agenda",
        actionKind: "internal-route",
        actionLabel: "agenda cita",
        keywords: [
          "agenda",
          "agenda citas",
          "citas",
          "programar cita",
          "crear cita",
        ],
      },
      {
        title: "Escanear QR de Visita",
        description: "Ir al control de visitas",
        path: "/visitas",
        actionKind: "internal-route",
        actionLabel: "qr visita",
        keywords: ["qr visita", "validar qr", "visita qr", "escaneo visita"],
      },
    ],

    bitacora: [
      {
        title: "Ver Bitácora",
        description: "Abrir historial de eventos",
        path: "/bitacora",
        actionKind: "internal-route",
        actionLabel: "ver bitacora",
        keywords: [
          "bitacora",
          "bitácora",
          "historial",
          "registro",
          "ver eventos",
        ],
      },
      {
        title: "Reportes de Bitácora",
        description: "Abrir reportes y métricas",
        path: "/bitacora?tab=reportes",
        actionKind: "internal-route",
        actionLabel: "reportes bitacora",
        keywords: [
          "reportes bitacora",
          "metricas bitacora",
          "estadisticas bitacora",
        ],
      },
    ],

    iam: [
      {
        title: "Nuevo Usuario",
        description: "Crear usuario del sistema",
        path: "/iam?action=create-user",
        actionKind: "internal-route",
        actionLabel: "crear usuario",
        keywords: [
          "crear usuario",
          "nuevo usuario",
          "registrar usuario",
          "agregar usuario",
        ],
      },
      {
        title: "Roles y Permisos",
        description: "Administrar permisos",
        path: "/iam?tab=roles",
        actionKind: "internal-route",
        actionLabel: "roles permisos",
        keywords: [
          "roles",
          "permisos",
          "usuarios y permisos",
          "editar permisos",
        ],
      },
      {
        title: "Eliminar Usuario",
        description: "Ir al módulo de usuarios para eliminar",
        path: "/iam",
        actionKind: "internal-route",
        actionLabel: "eliminar usuario",
        keywords: [
          "eliminar usuario",
          "borrar usuario",
          "quitar usuario",
          "dar de baja usuario",
        ],
      },
    ],
  };

  const out = [];

  for (const mod of allowed) {
    const key = String(mod.key || "").toLowerCase();
    const items = catalog[key] || [];

    for (const item of items) {
      out.push({
        id: `action-${key}-${item.title}`,
        type: "action",
        title: item.title,
        description: item.description,
        path: item.path,
        actionKind: item.actionKind,
        actionLabel: item.actionLabel,
        section: `${mod.label || key} · Acciones`,
        moduleKey: key,
        keywords: [...(item.keywords || []), key, mod.label].filter(Boolean),
        icon: mod.icon || null,
      });
    }
  }

  return out;
}

function filterEntriesByRole(entries, modules, isAdminSearch) {
  const list = Array.isArray(entries) ? entries : [];
  if (isAdminSearch) return list;

  const allowed = getAllowedModuleKeys(modules);

  return list.filter((item) => {
    if (!item.moduleKey) return item.path === "/";
    return allowed.has(String(item.moduleKey).toLowerCase());
  });
}

/* -------------------------
   Main component
------------------------- */
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

  const isAdminSearch = React.useMemo(
    () => hasAdminAccess(principal),
    [principal]
  );

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

  const localEntries = React.useMemo(() => {
    const routes = filterEntriesByRole(
      getGlobalRouteEntries(),
      modules,
      isAdminSearch
    );
    const moduleEntries = buildModuleSearchEntries(modules);
    const actionEntries = buildModuleActionEntries(modules);

    return dedupeEntries([...routes, ...moduleEntries, ...actionEntries]);
  }, [modules, isAdminSearch]);

  const [q, setQ] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [desktopSearchFocused, setDesktopSearchFocused] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recentSearches, setRecentSearches] = React.useState(() =>
    readRecentSearches()
  );
  const [remoteResults, setRemoteResults] = React.useState([]);
  const [loadingRemote, setLoadingRemote] = React.useState(false);

  const desktopSearchWrapRef = React.useRef(null);
  const desktopInputRef = React.useRef(null);
  const modalInputRef = React.useRef(null);

  const trimmedQuery = String(q || "").trim();
  const likelyUrl = isLikelyUrl(trimmedQuery);

  const smartResults = React.useMemo(() => {
    return buildSearchResults(trimmedQuery, localEntries);
  }, [trimmedQuery, localEntries]);

  React.useEffect(() => {
    if (!trimmedQuery || trimmedQuery.length < 2 || likelyUrl || isVisitor) {
      setRemoteResults([]);
      setLoadingRemote(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function runRemoteSearch() {
      setLoadingRemote(true);

      try {
        const res = await fetch(
          `/api/search/global?q=${encodeURIComponent(trimmedQuery)}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (!res.ok) throw new Error("search_failed");

        const data = await res.json();
        if (cancelled) return;

        const rows = Array.isArray(data?.results) ? data.results : [];
        setRemoteResults(rows);
      } catch {
        if (!cancelled) setRemoteResults([]);
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    }

    const t = setTimeout(runRemoteSearch, 180);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(t);
    };
  }, [trimmedQuery, likelyUrl, isVisitor]);

  const searchActions = React.useMemo(() => {
    const actions = [];

    if (!trimmedQuery) return actions;

    if (likelyUrl) {
      if (isInternalProgramUrl(trimmedQuery)) {
        actions.push({
          id: "action-internal-url",
          type: "action",
          title: "Abrir ruta interna del sistema",
          description: internalPathFromValue(trimmedQuery),
          actionKind: "internal-url",
          value: trimmedQuery,
          section: "Acciones",
        });
      } else {
        actions.push({
          id: "action-external-url",
          type: "action",
          title: "Abrir URL externa",
          description: toAbsoluteUrl(trimmedQuery),
          actionKind: "external-url",
          value: trimmedQuery,
          section: "Acciones",
        });
      }
      return actions;
    }

    const currentBase = getCurrentModuleBase(pathname);

    actions.push({
      id: "action-current-module",
      type: "action",
      title: "Buscar en el módulo actual",
      description: `Filtrar en ${currentBase.label}`,
      actionKind: "current-module-search",
      value: trimmedQuery,
      path: currentBase.path,
      section: "Acciones",
    });

    return actions;
  }, [trimmedQuery, likelyUrl, pathname]);

  const visibleSuggestions = React.useMemo(() => {
    if (!trimmedQuery) {
      return recentSearches.map((item, index) => ({
        id: `recent-${index}-${item}`,
        type: "recent",
        title: item,
        description: "Búsqueda reciente",
        section: "Recientes",
        value: item,
      }));
    }

    return dedupeEntries([
      ...smartResults,
      ...remoteResults,
      ...searchActions,
    ]).slice(0, MAX_RESULTS);
  }, [trimmedQuery, recentSearches, smartResults, remoteResults, searchActions]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery, desktopSearchFocused, searchOpen]);

  React.useEffect(() => {
    setDesktopSearchFocused(false);
    setSearchOpen(false);
    setActiveIndex(0);
  }, [pathname]);

  React.useEffect(() => {
    if (isVisitor) return;

    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => modalInputRef.current?.focus(), 40);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVisitor]);

  useDismissOnOutside(
    !searchOpen && desktopSearchFocused,
    [desktopSearchWrapRef],
    () => {
      setDesktopSearchFocused(false);
      setActiveIndex(0);
    }
  );

  function closeAllSearchUi() {
    setDesktopSearchFocused(false);
    setSearchOpen(false);
    setActiveIndex(0);
  }

  function runModuleSearch(text) {
    const query = String(text || "").trim();
    const base = getCurrentModuleBase(pathname).path;

    if (query) nav(`${base}?q=${encodeURIComponent(query)}`);
    else nav(base);
  }

  function executeSuggestion(item) {
    if (!item) {
      if (!trimmedQuery) return;

      if (likelyUrl) {
        if (isInternalProgramUrl(trimmedQuery)) {
          nav(internalPathFromValue(trimmedQuery));
        } else {
          window.open(toAbsoluteUrl(trimmedQuery), "_blank", "noopener,noreferrer");
        }
      } else {
        runModuleSearch(trimmedQuery);
      }

      pushRecentSearch(trimmedQuery);
      setRecentSearches(readRecentSearches());
      closeAllSearchUi();
      return;
    }

    if (item.type === "recent") {
      setQ(item.value || item.title || "");
      return;
    }

    if (
      item.type === "route" ||
      item.type === "module" ||
      item.type === "entity"
    ) {
      const textForRecent = item.title || item.path || "";
      if (textForRecent) {
        pushRecentSearch(textForRecent);
        setRecentSearches(readRecentSearches());
      }

      if (item.path) nav(item.path);
      closeAllSearchUi();
      return;
    }

    if (item.type === "action") {
      if (item.actionKind === "internal-url") {
        nav(internalPathFromValue(item.value));
      } else if (item.actionKind === "external-url") {
        window.open(toAbsoluteUrl(item.value), "_blank", "noopener,noreferrer");
      } else if (item.actionKind === "current-module-search") {
        runModuleSearch(item.value);
      } else if (item.actionKind === "internal-route" && item.path) {
        nav(item.path);
      }

      pushRecentSearch(item.actionLabel || item.value || item.title || "");
      setRecentSearches(readRecentSearches());
      closeAllSearchUi();
    }
  }

  function handleSearchSubmit() {
    const selected = visibleSuggestions[activeIndex] || null;
    executeSuggestion(selected);
  }

  function handleSearchKeyDown(e) {
    const count = visibleSuggestions.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!count) return;
      setActiveIndex((prev) => (prev + 1) % count);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!count) return;
      setActiveIndex((prev) => (prev - 1 + count) % count);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSubmit();
      return;
    }

    if (e.key === "Escape") {
      closeAllSearchUi();
    }
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
    } catch {}
  }, [isVisitor]);

  const clearCounts = React.useCallback(async () => {
    try {
      await NotificationsAPI.markAllRead();
      await fetchCounts();
    } catch {}
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
        onMouseEnter={(e) =>
          Object.assign(e.currentTarget.style, controlHoverStyle())
        }
        onMouseLeave={(e) =>
          Object.assign(e.currentTarget.style, controlStyle())
        }
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
          <div ref={desktopSearchWrapRef} className="relative w-[560px]">
            <div
              className="relative overflow-hidden rounded-[20px]"
              style={{
                border: "1px solid var(--input-border)",
                background:
                  "color-mix(in srgb, var(--input-bg) 92%, transparent)",
                boxShadow: "0 10px 35px rgba(2,6,23,.12)",
              }}
            >
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: "var(--text-muted)", opacity: 0.95, zIndex: 2 }}
              />

              <input
                ref={desktopInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setDesktopSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar rutas, acciones, módulos o URL... (Ctrl/⌘+K)"
                className="w-full bg-transparent pl-12 pr-10 py-3 text-sm outline-none"
                style={{
                  color: "var(--text)",
                  caretColor: "var(--text)",
                }}
              />

              {q && (
                <button
                  className="absolute right-2 top-1/2 rounded-xl p-1.5 -translate-y-1/2 transition"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => {
                    setQ("");
                    desktopInputRef.current?.focus();
                  }}
                  aria-label="Limpiar"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {desktopSearchFocused && (
              <SearchSuggestions
                query={trimmedQuery}
                results={visibleSuggestions}
                activeIndex={activeIndex}
                onHoverIndex={setActiveIndex}
                onSelect={executeSuggestion}
                loading={loadingRemote}
                modeLabel={
                  isAdminSearch
                    ? "Búsqueda global completa"
                    : "Búsqueda según tus módulos permitidos"
                }
              />
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
          className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[12vh]"
          style={{
            background: "rgba(2, 6, 23, 0.8)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className={fxModal}
            style={popoverStyle()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mb-3 flex items-center gap-2 text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {isAdminSearch
                  ? "Búsqueda global inteligente"
                  : "Búsqueda inteligente por módulos permitidos"}
              </span>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: "var(--text-muted)", opacity: 0.95, zIndex: 2 }}
              />

              <input
                ref={modalInputRef}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Busca módulos, acciones, rutas, datos o pega una URL..."
                className="w-full rounded-[18px] border bg-transparent pl-12 pr-10 py-4 text-base outline-none"
                style={{
                  borderColor: "var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                  caretColor: "var(--text)",
                }}
              />

              {q && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 rounded-lg p-1.5 -translate-y-1/2 transition"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => {
                    setQ("");
                    modalInputRef.current?.focus();
                  }}
                  aria-label="Limpiar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div
              className="mt-3 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              ↑ ↓ para navegar · Enter para abrir · Esc para cerrar
            </div>

            <div className="mt-3">
              <SearchSuggestions
                query={trimmedQuery}
                results={visibleSuggestions}
                activeIndex={activeIndex}
                onHoverIndex={setActiveIndex}
                onSelect={executeSuggestion}
                loading={loadingRemote}
                modeLabel={
                  isAdminSearch
                    ? "Incluye datos y navegación global"
                    : "Incluye tus módulos y acciones permitidas"
                }
                inModal
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Search UI ---------- */

function SearchSuggestions({
  query,
  results,
  activeIndex,
  onHoverIndex,
  onSelect,
  loading = false,
  modeLabel = "",
  inModal = false,
}) {
  const items = Array.isArray(results) ? results : [];
  const hasItems = items.length > 0;

  return (
    <div
      className={
        inModal
          ? "overflow-hidden rounded-[18px]"
          : "absolute left-0 right-0 top-[calc(100%+10px)] z-[120] overflow-hidden rounded-[18px]"
      }
      style={popoverStyle()}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-2 text-[11px] uppercase tracking-wide"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <span>{modeLabel || "Resultados"}</span>
        {loading ? <span>Buscando…</span> : <span>{items.length} opciones</span>}
      </div>

      {!hasItems ? (
        <div
          className="px-4 py-4 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {query
            ? "No encontré coincidencias. Puedes presionar Enter para buscar dentro del módulo actual."
            : "Empieza a escribir para ver sugerencias o una búsqueda reciente."}
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto p-2">
          {items.map((item, index) => {
            const active = index === activeIndex;

            return (
              <button
                key={item.id || `${item.type}-${index}`}
                type="button"
                onMouseEnter={() => onHoverIndex(index)}
                onClick={() => onSelect(item)}
                className="flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-all duration-150"
                style={{
                  background: active
                    ? "color-mix(in srgb, var(--panel) 78%, transparent)"
                    : "transparent",
                  color: "var(--text)",
                }}
              >
                <SearchResultIcon item={item} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {item.title}
                  </div>
                  <div
                    className="truncate text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.description || item.path || item.section}
                  </div>
                </div>

                <div
                  className="shrink-0 rounded-lg px-2 py-1 text-[10px] uppercase tracking-wide"
                  style={softBadgeStyle()}
                >
                  {item.section || item.type}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchResultIcon({ item }) {
  const IconFromItem = item?.icon || null;

  if (IconFromItem) {
    return (
      <span
        className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={softBadgeStyle()}
      >
        <IconFromItem className="h-4 w-4" />
      </span>
    );
  }

  if (item?.type === "recent") {
    return (
      <span
        className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={softBadgeStyle()}
      >
        <Clock3 className="h-4 w-4" />
      </span>
    );
  }

  if (item?.actionKind === "external-url") {
    return (
      <span
        className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={softBadgeStyle()}
      >
        <ExternalLink className="h-4 w-4" />
      </span>
    );
  }

  if (item?.actionKind === "internal-url") {
    return (
      <span
        className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={softBadgeStyle()}
      >
        <CornerDownLeft className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl"
      style={softBadgeStyle()}
    >
      <Search className="h-4 w-4" />
    </span>
  );
}

/* ---------- Subcomponentes ---------- */

function getCurrentModuleBase(pathname) {
  if (pathname.startsWith("/visitas")) return { path: "/visitas", label: "Visitas" };
  if (pathname.startsWith("/bitacora")) return { path: "/bitacora", label: "Bitácora" };
  if (pathname.startsWith("/rondasqr")) return { path: "/rondasqr", label: "Rondas QR" };
  if (pathname.startsWith("/rondas")) return { path: "/rondas", label: "Rondas" };
  if (pathname.startsWith("/accesos")) return { path: "/accesos", label: "Control de Acceso" };
  if (pathname.startsWith("/iam")) return { path: "/iam", label: "IAM" };
  if (pathname.startsWith("/incidentes")) return { path: "/incidentes", label: "Incidentes" };
  return { path: "/incidentes", label: "Incidentes" };
}

function TopbarQuickMenu({
  nav,
  open,
  toggle,
  btnRef,
  menuRef,
  pos,
  fxBtn,
  modules = [],
}) {
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