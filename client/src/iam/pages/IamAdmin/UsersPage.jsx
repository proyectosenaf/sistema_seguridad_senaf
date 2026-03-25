import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi.js";
import {
  Edit3,
  Trash2,
  Wifi,
  RefreshCw,
  LogOut,
  Monitor,
  Smartphone,
  Globe,
  History,
  FileText,
  FileSpreadsheet,
  FileDown,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getToken as getTokenCanonical } from "../../../lib/api.js";

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";

/* =========================
   Styles
========================= */
function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxCardSoft(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

function sxBtnBase(extra = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    minHeight: "38px",
    padding: "0 14px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    transition:
      "transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return sxBtnBase({
    background: "color-mix(in srgb, var(--card-solid) 90%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  });
}

function sxPrimaryBtn(extra = {}) {
  return sxBtnBase({
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#ffffff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  });
}

function sxTableActionBtn(kind = "neutral", extra = {}) {
  const common = {
    minHeight: "34px",
    padding: "0 12px",
    borderRadius: "11px",
    fontSize: "12px",
    fontWeight: 600,
  };

  if (kind === "warning") {
    return sxBtnBase({
      ...common,
      background: "color-mix(in srgb, #f59e0b 12%, var(--card-solid))",
      color: "#d97706",
      border: "1px solid color-mix(in srgb, #f59e0b 34%, transparent)",
      boxShadow: "var(--shadow-sm)",
      ...extra,
    });
  }

  if (kind === "success") {
    return sxBtnBase({
      ...common,
      background: "color-mix(in srgb, #22c55e 12%, var(--card-solid))",
      color: "#15803d",
      border: "1px solid color-mix(in srgb, #22c55e 34%, transparent)",
      boxShadow: "var(--shadow-sm)",
      ...extra,
    });
  }

  if (kind === "danger") {
    return sxBtnBase({
      ...common,
      background: "color-mix(in srgb, #ef4444 10%, var(--card-solid))",
      color: "#dc2626",
      border: "1px solid color-mix(in srgb, #ef4444 28%, transparent)",
      boxShadow: "var(--shadow-sm)",
      ...extra,
    });
  }

  return sxBtnBase({
    ...common,
    background: "color-mix(in srgb, var(--card-solid) 92%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  });
}

function sxStickyHead(extra = {}) {
  return {
    position: "sticky",
    top: 0,
    zIndex: 25,
    paddingTop: "0.5rem",
    paddingBottom: "1rem",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--bg) 97%, transparent) 0%, color-mix(in srgb, var(--bg) 94%, transparent) 72%, color-mix(in srgb, var(--bg) 0%, transparent) 100%)",
    backdropFilter: "blur(10px) saturate(125%)",
    WebkitBackdropFilter: "blur(10px) saturate(125%)",
    ...extra,
  };
}

function sxStickyDivider(extra = {}) {
  return {
    height: "1px",
    marginTop: "0.85rem",
    background:
      "linear-gradient(90deg, transparent, color-mix(in srgb, var(--border) 88%, transparent), transparent)",
    ...extra,
  };
}

function sxModalOverlay(extra = {}) {
  const SIDEBAR_WIDTH = 260;

  return {
    position: "fixed",
    top: 0,
    left: SIDEBAR_WIDTH,
    width: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
    height: "100vh",
    zIndex: 120,
    background: "rgba(2, 6, 23, 0.72)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    ...extra,
  };
}

function sxModalCard(extra = {}) {
  return {
    width: "min(1050px, calc(100vw - 80px))",
    maxHeight: "min(88vh, 920px)",
    overflow: "hidden",
    borderRadius: "28px",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, transparent) 0%, color-mix(in srgb, var(--card-solid) 94%, transparent) 100%)",
    border: "1px solid color-mix(in srgb, var(--border) 92%, transparent)",
    boxShadow:
      "0 30px 90px rgba(0,0,0,.45), 0 8px 28px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04)",
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
    ...extra,
  };
}

/* =========================
   Utilities
========================= */
function scrollMainToTop(behavior = "smooth") {
  const main = document.getElementById("app-main");
  if (main && typeof main.scrollTo === "function") {
    main.scrollTo({ top: 0, behavior });
    return;
  }

  const scrollable = main?.querySelector?.(".overflow-y-auto");
  if (scrollable && typeof scrollable.scrollTo === "function") {
    scrollable.scrollTo({ top: 0, behavior });
    return;
  }

  window.scrollTo({ top: 0, behavior });
}

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }

  componentDidCatch(err, info) {
    console.error("[UsersPage] render error:", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="max-w-3xl mx-auto rounded-[24px] p-5" style={sxCard()}>
            <div
              className="text-lg font-semibold mb-2"
              style={{ color: "#fecaca" }}
            >
              Se cayó la pantalla de Usuarios por un error de render.
            </div>
            <div className="text-sm" style={{ color: "var(--text)" }}>
              Revisa consola. Mensaje:
              <div
                className="mt-2 p-3 rounded-xl font-mono text-xs whitespace-pre-wrap"
                style={{
                  background:
                    "color-mix(in srgb, var(--card-solid) 88%, transparent)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              >
                {String(
                  this.state.err?.message || this.state.err || "Unknown error"
                )}
              </div>
            </div>
            <button
              className="mt-4"
              style={sxPrimaryBtn()}
              onClick={() => this.setState({ hasError: false, err: null })}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function getVal(obj, paths, fallback = "") {
  for (const p of paths) {
    const v = p.includes(".") ? getPath(obj, p) : obj?.[p];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function normalizeRoles(api) {
  let roles = getVal(api, ["roles"], []);
  if (typeof roles === "string") roles = [roles];
  if (Array.isArray(roles)) {
    return roles
      .map((r) =>
        typeof r === "string"
          ? r
          : r?.code || r?.name || r?.nombre || r?.key || ""
      )
      .filter(Boolean);
  }
  return [];
}

function mapUserToFormSafeMini(api = {}) {
  const nombreCompleto = getVal(api, ["nombreCompleto", "fullName", "name"], "");
  const email = getVal(api, ["email", "correoPersona", "correo", "mail"], "");
  const roles = normalizeRoles(api);

  const active =
    getVal(api, ["active"], undefined) ??
    (String(getVal(api, ["estado"], "")).toLowerCase() === "inactivo"
      ? false
      : true);

  const mustChangePassword =
    getVal(api, ["mustChangePassword"], undefined) ??
    getVal(api, ["forcePwChange"], undefined) ??
    false;

  return {
    nombreCompleto,
    email,
    roles,
    active,
    forcePwChange: !!mustChangePassword,
    _id: getVal(api, ["_id", "id"], undefined),
  };
}

function useClickOutside(ref, handler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const onDown = (e) => {
      const el = ref?.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      handlerRef.current?.(e);
    };

    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [ref, enabled]);
}

function RoleBadges({ roles = [], roleLabelMap = {} }) {
  const labels = Array.isArray(roles)
    ? roles.map((code) => roleLabelMap[code] || code)
    : [];

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.length === 0 ? (
        <span style={{ color: "var(--text-muted)" }}>—</span>
      ) : (
        labels.map((r, i) => (
          <span
            key={`${r}-${i}`}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: "color-mix(in srgb, #06b6d4 10%, transparent)",
              color: "#0f766e",
              border: "1px solid color-mix(in srgb, #06b6d4 26%, transparent)",
              fontWeight: 600,
            }}
          >
            {r}
          </span>
        ))
      )}
    </div>
  );
}

function RoleSelect({ value = [], onChange, availableRoles = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useClickOutside(rootRef, () => setOpen(false), open);

  const selected = new Set(Array.isArray(value) ? value : []);
  const normalizedRoles = useMemo(
    () =>
      (availableRoles || [])
        .map((r) => ({
          code: r.code || r.key || r.name || r._id,
          label: r.name || r.label || r.code || r.key || r._id,
        }))
        .filter((r) => !!r.code),
    [availableRoles]
  );

  const toggle = (code) => {
    const copy = new Set(selected);
    if (copy.has(code)) copy.delete(code);
    else copy.add(code);
    onChange(Array.from(copy));
  };

  const labelSelected =
    normalizedRoles
      .filter((r) => selected.has(r.code))
      .map((r) => r.label)
      .join(", ") || "Seleccionar rol(es)";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2"
        style={sxInput({ minHeight: "42px" })}
      >
        <span className="truncate">{labelSelected}</span>
        <span className="ml-auto text-xs opacity-70">▾</span>
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl"
          style={sxCard()}
        >
          {normalizedRoles.length === 0 && (
            <div
              className="px-3 py-2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No hay roles configurados.
            </div>
          )}

          {normalizedRoles.map((r) => (
            <label
              key={r.code}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer"
              style={{ color: "var(--text)" }}
            >
              <input
                type="checkbox"
                className="scale-110 accent-cyan-500"
                checked={selected.has(r.code)}
                onChange={() => toggle(r.code)}
              />
              <span className="truncate">{r.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

function PresencePill({ presence }) {
  const val = String(presence || "").toLowerCase();

  const map = {
    online: {
      label: "En línea",
      bg: "color-mix(in srgb, #22c55e 12%, transparent)",
      color: "#15803d",
      border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
    },
    idle: {
      label: "Inactiva",
      bg: "color-mix(in srgb, #f59e0b 12%, transparent)",
      color: "#d97706",
      border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
    },
    inactive: {
      label: "Sin actividad",
      bg: "color-mix(in srgb, #f97316 12%, transparent)",
      color: "#ea580c",
      border: "1px solid color-mix(in srgb, #f97316 36%, transparent)",
    },
    offline: {
      label: "Desconectada",
      bg: "color-mix(in srgb, #64748b 12%, transparent)",
      color: "#475569",
      border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
    },
    kicked: {
      label: "Expulsada",
      bg: "color-mix(in srgb, #ef4444 12%, transparent)",
      color: "#dc2626",
      border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
    },
    closed: {
      label: "Cerrada",
      bg: "color-mix(in srgb, #ef4444 12%, transparent)",
      color: "#dc2626",
      border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
    },
    replaced: {
      label: "Reemplazada",
      bg: "color-mix(in srgb, #8b5cf6 12%, transparent)",
      color: "#7c3aed",
      border: "1px solid color-mix(in srgb, #8b5cf6 36%, transparent)",
    },
    active: {
      label: "Activa",
      bg: "color-mix(in srgb, #22c55e 12%, transparent)",
      color: "#15803d",
      border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
    },
  };

  const sx = map[val] || map.offline;

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{
        background: sx.bg,
        color: sx.color,
        border: sx.border,
      }}
    >
      <span className="w-2 h-2 rounded-full mr-1 bg-current" />
      {sx.label}
    </span>
  );
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function parseJwtPayload(token) {
  try {
    const raw = String(token || "").trim();
    if (!raw) return null;
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeBrowserName(ua = "") {
  const s = String(ua || "").toLowerCase();

  if (s.includes("edg/")) return "Edge";
  if (s.includes("opr/") || s.includes("opera")) return "Opera";
  if (s.includes("samsungbrowser")) return "Samsung Browser";
  if (s.includes("chrome/") && !s.includes("edg/")) return "Chrome";
  if (s.includes("firefox/")) return "Firefox";
  if (s.includes("safari/") && !s.includes("chrome/")) return "Safari";
  return "Navegador";
}

function normalizeOsName(ua = "") {
  const s = String(ua || "").toLowerCase();

  if (s.includes("windows nt")) return "Windows";
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ios")) {
    return "iOS";
  }
  if (s.includes("mac os") || s.includes("macintosh")) return "macOS";
  if (s.includes("linux")) return "Linux";
  return "Sistema";
}

function summarizeDevice(session = {}) {
  const ua = String(session?.userAgent || session?.device || "").trim();
  if (!ua) {
    return {
      label: "Dispositivo no identificado",
      icon: Globe,
    };
  }

  const browser = normalizeBrowserName(ua);
  const os = normalizeOsName(ua);
  const isMobile = /android|iphone|ipad|mobile/i.test(ua);

  return {
    label: `${os} / ${browser}`,
    icon: isMobile ? Smartphone : Monitor,
  };
}

function CurrentSessionPill() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: "color-mix(in srgb, #2563eb 12%, transparent)",
        color: "#2563eb",
        border: "1px solid color-mix(in srgb, #2563eb 32%, transparent)",
      }}
    >
      Sesión actual
    </span>
  );
}

function normalizeSessionHistoryItem(raw = {}) {
  return {
    _id: raw?._id || raw?.id || raw?.sessionId || cryptoRandomLike(),
    sessionId: String(raw?.sessionId || raw?.sid || "").trim(),
    userId: String(raw?.userId || "").trim(),
    email: String(raw?.email || "").trim(),
    name: String(raw?.name || raw?.nombreCompleto || raw?.email || "—").trim(),
    status: String(raw?.status || raw?.presence || "active").trim(),
    presence: String(raw?.presence || raw?.status || "").trim(),
    ip: String(raw?.ip || "").trim(),
    userAgent: String(raw?.userAgent || "").trim(),
    device: String(raw?.device || raw?.userAgent || "").trim(),
    connectedAt: raw?.connectedAt || raw?.createdAt || raw?.loginAt || null,
    lastActivityAt: raw?.lastActivityAt || null,
    disconnectedAt: raw?.disconnectedAt || raw?.logoutAt || null,
    logoutAt: raw?.logoutAt || null,
    kickedAt: raw?.kickedAt || null,
    reason: String(raw?.reason || "").trim(),
  };
}

function cryptoRandomLike() {
  return `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function escapeCsvValue(v) {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildHistoryRowsForExport(list = []) {
  return list.map((it, idx) => ({
    "#": idx + 1,
    Usuario: it.name || "—",
    Correo: it.email || "—",
    Estado: it.status || it.presence || "—",
    IP: it.ip || "—",
    Dispositivo: summarizeDevice(it).label || "—",
    "User Agent": it.device || it.userAgent || "—",
    Conectado: fmtDateTime(it.connectedAt),
    "Última actividad": fmtDateTime(it.lastActivityAt),
    Desconectado: fmtDateTime(it.disconnectedAt || it.logoutAt || it.kickedAt),
    Motivo: it.reason || "—",
    "Session ID": it.sessionId || "—",
  }));
}

function downloadBlob(content, mime, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportHistoryCsvLocal(list = []) {
  const rows = buildHistoryRowsForExport(list);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(",")),
  ].join("\n");

  downloadBlob(
    "\uFEFF" + csv,
    "text/csv;charset=utf-8;",
    `historial_ingresos_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
  );
}

async function exportHistoryExcelLocal(list = []) {
  const rows = buildHistoryRowsForExport(list);

  try {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      wbout,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `historial_ingresos_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`
    );
  } catch (e) {
    console.error("[UsersPage] Error exportando Excel:", e);
    alert("No se pudo exportar a Excel.");
  }
}

async function exportHistoryPdfLocal(list = []) {
  const rows = buildHistoryRowsForExport(list);

  try {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF("l", "pt", "a4");
    doc.setFontSize(14);
    doc.text("Historial de ingresos / sesiones", 40, 34);

    autoTable(doc, {
      startY: 50,
      head: [
        [
          "#",
          "Usuario",
          "Correo",
          "Estado",
          "IP",
          "Dispositivo",
          "Conectado",
          "Última actividad",
          "Desconectado",
        ],
      ],
      body: rows.map((r) => [
        r["#"],
        r["Usuario"],
        r["Correo"],
        r["Estado"],
        r["IP"],
        r["Dispositivo"],
        r["Conectado"],
        r["Última actividad"],
        r["Desconectado"],
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [37, 99, 235],
      },
    });

    doc.save(
      `historial_ingresos_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`
    );
  } catch (e) {
    console.error("[UsersPage] Error exportando PDF:", e);
    alert("No se pudo exportar a PDF.");
  }
}

function refOrWrapper(ref) {
  return { current: ref.current };
}

function normalizeHistoryStatus(v = "") {
  return String(v || "").trim().toLowerCase();
}

function normalizeHistoryDeviceLabel(item = {}) {
  return String(summarizeDevice(item).label || "")
    .trim()
    .toLowerCase();
}

function isWithinDateRange(dateValue, from, to) {
  if (!dateValue) return false;

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;

  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && d < start) return false;
  }

  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(end.getTime()) && d > end) return false;
  }

  return true;
}

function filterHistoryItems(items = [], filters = {}) {
  const q = String(filters?.q || "").trim().toLowerCase();
  const status = normalizeHistoryStatus(filters?.status);
  const device = String(filters?.device || "").trim().toLowerCase();
  const dateFrom = String(filters?.dateFrom || "").trim();
  const dateTo = String(filters?.dateTo || "").trim();

  return items.filter((item) => {
    const textMatch =
      !q ||
      String(item?.name || "").toLowerCase().includes(q) ||
      String(item?.email || "").toLowerCase().includes(q) ||
      String(item?.ip || "").toLowerCase().includes(q) ||
      String(item?.reason || "").toLowerCase().includes(q) ||
      String(item?.device || item?.userAgent || "")
        .toLowerCase()
        .includes(q);

    const statusMatch =
      !status ||
      normalizeHistoryStatus(item?.status || item?.presence) === status;

    const deviceLabel = normalizeHistoryDeviceLabel(item);
    const deviceMatch =
      !device ||
      deviceLabel.includes(device) ||
      String(item?.device || item?.userAgent || "")
        .toLowerCase()
        .includes(device);

    const dateMatch = isWithinDateRange(item?.connectedAt, dateFrom, dateTo);

    return textMatch && statusMatch && deviceMatch && dateMatch;
  });
}

/* =========================
   Modal
========================= */
function InfoMini({ label, value }) {
  return (
    <div
      className="rounded-[18px] px-4 py-3"
      style={{
        background: "color-mix(in srgb, var(--card-solid) 90%, transparent)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-sm font-medium break-words"
        style={{ color: "var(--text)" }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function SessionHistoryModal({
  open,
  onClose,
  historyItems = [],
  historyLoading = false,
  historyErr = "",
  page = 1,
  setPage,
  totalHistory = 0,
  onRefresh,
  onExportCsv,
  onExportExcel,
  onExportPdf,
  filters,
  setFilters,
}) {
  const rootRef = useRef(null);
  useClickOutside(refOrWrapper(rootRef), () => onClose?.(), open);

  const pageSize = 5;
  const totalPages = Math.max(
    1,
    Math.ceil((totalHistory || historyItems.length || 0) / pageSize)
  );
  const latest = historyItems[0] || null;

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={sxModalOverlay()}>
      <div ref={rootRef} style={sxModalCard()}>
        <div
          className="px-5 md:px-6 py-4 md:py-5 flex flex-col gap-4"
          style={{
            borderBottom: "1px solid var(--border)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--card-solid) 96%, transparent) 0%, color-mix(in srgb, var(--card-solid) 88%, transparent) 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div
                className="text-[1.08rem] md:text-[1.2rem] font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                Historial de ingresos / sesiones
              </div>
              <div
                className="text-xs md:text-sm mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Registros históricos del ingreso al sistema, paginados de 5 en 5.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onRefresh}
                disabled={historyLoading}
                style={sxGhostBtn()}
              >
                <RefreshCw
                  className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`}
                />
                Actualizar
              </button>

              <button type="button" onClick={onExportPdf} style={sxGhostBtn()}>
                <FileText className="w-4 h-4" />
                PDF
              </button>

              <button type="button" onClick={onExportExcel} style={sxGhostBtn()}>
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>

              <button type="button" onClick={onExportCsv} style={sxGhostBtn()}>
                <FileDown className="w-4 h-4" />
                CSV
              </button>

              <button
                type="button"
                onClick={onClose}
                style={sxGhostBtn({ minHeight: "38px", padding: "0 12px" })}
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-3 flex-wrap text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Total de registros: {totalHistory || historyItems.length}</span>
            <span>
              Página {page} de {totalPages}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(88vh-110px)] px-5 md:px-6 py-5 space-y-5">
          <section className="rounded-[20px] p-4 md:p-5" style={sxCardSoft()}>
            <div className="flex flex-col gap-4">
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Filtros del historial
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Filtra por estado, dispositivo, fechas o búsqueda libre.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <input
                  value={filters?.q || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, q: e.target.value }))
                  }
                  placeholder="Buscar usuario, correo, IP..."
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                />

                <select
                  value={filters?.status || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Activa</option>
                  <option value="online">En línea</option>
                  <option value="idle">Inactiva</option>
                  <option value="inactive">Sin actividad</option>
                  <option value="replaced">Reemplazada</option>
                  <option value="closed">Cerrada</option>
                  <option value="kicked">Expulsada</option>
                </select>

                <input
                  value={filters?.device || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, device: e.target.value }))
                  }
                  placeholder="Dispositivo o navegador"
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                />

                <input
                  type="date"
                  value={filters?.dateFrom || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                  title="Desde"
                />

                <input
                  type="date"
                  value={filters?.dateTo || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                  title="Hasta"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      q: "",
                      status: "",
                      device: "",
                      dateFrom: "",
                      dateTo: "",
                    })
                  }
                  style={sxGhostBtn({ minHeight: "36px" })}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </section>

          {latest && (
            <section
              className="rounded-[24px] p-5 md:p-6"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, #2563eb 10%, var(--card-solid)) 0%, color-mix(in srgb, #06b6d4 8%, var(--card-solid)) 100%)",
                border: "1px solid color-mix(in srgb, #38bdf8 20%, var(--border))",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex flex-col xl:flex-row gap-5 xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div
                    className="text-xs uppercase tracking-wide font-semibold mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Último ingreso registrado
                  </div>

                  <div
                    className="text-xl md:text-2xl font-semibold truncate"
                    style={{ color: "var(--text)" }}
                    title={latest.name || latest.email || "—"}
                  >
                    {latest.name || latest.email || "—"}
                  </div>

                  <div
                    className="text-sm mt-1 truncate"
                    style={{ color: "var(--text-muted)" }}
                    title={latest.email || "—"}
                  >
                    {latest.email || "—"}
                  </div>

                  <div className="mt-3">
                    <PresencePill presence={latest.status || latest.presence} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:min-w-[460px]">
                  <InfoMini label="IP" value={latest.ip || "—"} />
                  <InfoMini
                    label="Dispositivo"
                    value={summarizeDevice(latest).label}
                  />
                  <InfoMini
                    label="Conectado"
                    value={fmtDateTime(latest.connectedAt)}
                  />
                  <InfoMini
                    label="Última actividad"
                    value={fmtDateTime(latest.lastActivityAt)}
                  />
                </div>
              </div>
            </section>
          )}

          {historyErr && (
            <div
              className="text-sm rounded-xl px-3 py-3"
              style={{
                background: "color-mix(in srgb, #ef4444 10%, transparent)",
                border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)",
                color: "#fca5a5",
              }}
            >
              {historyErr}
            </div>
          )}

          <section className="rounded-[24px] overflow-hidden" style={sxCard()}>
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[1450px] table-fixed text-sm"
                style={{ color: "var(--text)" }}
              >
                <thead
                  className="text-[11px] uppercase"
                  style={{
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border)",
                    background:
                      "color-mix(in srgb, var(--card-solid) 94%, transparent)",
                  }}
                >
                  <tr>
                    <th className="px-4 py-3 text-left w-[240px]">Usuario</th>
                    <th className="px-4 py-3 text-left w-[150px]">Estado</th>
                    <th className="px-4 py-3 text-left w-[150px]">IP</th>
                    <th className="px-4 py-3 text-left w-[370px]">Dispositivo</th>
                    <th className="px-4 py-3 text-left w-[210px]">Conectado</th>
                    <th className="px-4 py-3 text-left w-[210px]">
                      Última actividad
                    </th>
                    <th className="px-4 py-3 text-left w-[230px]">
                      Salida / cierre
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cargando historial…
                      </td>
                    </tr>
                  ) : historyItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No hay registros de historial.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((s) => {
                      const deviceInfo = summarizeDevice(s);
                      const DeviceIcon = deviceInfo.icon;

                      return (
                        <tr
                          key={s._id || s.sessionId || cryptoRandomLike()}
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="min-w-0">
                              <div
                                className="font-medium truncate"
                                style={{ color: "var(--text)" }}
                                title={s.name || s.email || "—"}
                              >
                                {s.name || s.email || "—"}
                              </div>
                              <div
                                className="text-[11px] mt-1 truncate"
                                style={{ color: "var(--text-muted)" }}
                                title={s.email || "—"}
                              >
                                {s.email || "—"}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-middle">
                            <PresencePill presence={s.status || s.presence} />
                          </td>

                          <td
                            className="px-4 py-4 align-middle font-medium"
                            style={{ color: "var(--text)" }}
                            title={s.ip || "—"}
                          >
                            {s.ip || "—"}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="flex items-start gap-3 min-w-0">
                              <DeviceIcon
                                className="w-4 h-4 shrink-0 mt-0.5"
                                style={{ color: "var(--text-muted)" }}
                              />
                              <div className="min-w-0">
                                <div
                                  className="truncate font-medium"
                                  title={deviceInfo.label}
                                  style={{ color: "var(--text)" }}
                                >
                                  {deviceInfo.label}
                                </div>
                                <div
                                  className="truncate text-[11px] mt-1"
                                  style={{ color: "var(--text-muted)" }}
                                  title={s.device || s.userAgent || "—"}
                                >
                                  {s.device || s.userAgent || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td
                            className="px-4 py-4 align-top break-words"
                            style={{ color: "var(--text)" }}
                          >
                            {fmtDateTime(s.connectedAt)}
                          </td>

                          <td
                            className="px-4 py-4 align-top break-words"
                            style={{ color: "var(--text)" }}
                          >
                            {fmtDateTime(s.lastActivityAt)}
                          </td>

                          <td
                            className="px-4 py-4 align-top break-words"
                            style={{ color: "var(--text)" }}
                          >
                            {fmtDateTime(
                              s.disconnectedAt || s.logoutAt || s.kickedAt
                            )}
                            {s.reason ? (
                              <div
                                className="text-[11px] mt-1"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {s.reason}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-1">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Mostrando página {page} de {totalPages}. Total de registros:{" "}
              {totalHistory || historyItems.length}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || historyLoading}
                style={sxGhostBtn({ minHeight: "36px" })}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || historyLoading}
                style={sxGhostBtn({ minHeight: "36px" })}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */
function UsersPageInner() {
  const [items, setItems] = useState([]);
  const [roleCatalog, setRoleCatalog] = useState([]);

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsErr, setSessionsErr] = useState("");
  const [kickingSessionId, setKickingSessionId] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyAllItems, setHistoryAllItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const HISTORY_PAGE_SIZE = 5;

  const [historyFilters, setHistoryFilters] = useState({
    q: "",
    status: "",
    device: "",
    dateFrom: "",
    dateTo: "",
  });

  const PAGE_SIZE = 5;
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const requestIdRef = useRef(0);

  const empty = {
    nombreCompleto: "",
    email: "",
    roles: [],
    active: true,
    forcePwChange: true,
  };

  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const [creds, setCreds] = useState({ password: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);

  const pwdR = passwordRules(creds.password);
  const match =
    creds.password && creds.confirm && creds.password === creds.confirm;
  const showPwdRules = creds.password && creds.password.length > 0;

  const firstFieldRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  function requireFn(fnName) {
    if (typeof iamApi?.[fnName] !== "function") {
      throw new Error(`iamApi.${fnName} no está implementado`);
    }
    return iamApi[fnName];
  }

  function requireTokenSafe() {
    if (DISABLE_AUTH) return null;
    const t = getTokenCanonical();
    return t || null;
  }

  const authToken = requireTokenSafe();
  const tokenPayload = useMemo(() => parseJwtPayload(authToken), [authToken]);
  const currentSessionId = String(tokenPayload?.sid || "").trim();
  const currentUserEmail = String(tokenPayload?.email || "")
    .trim()
    .toLowerCase();

  const roleLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (roleCatalog || []).map((r) => [
          r.code || r.key || r.name || r._id,
          r.name || r.label || r.code || r.key || "(sin nombre)",
        ])
      ),
    [roleCatalog]
  );

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function load({ append = false } = {}) {
    const myReqId = ++requestIdRef.current;

    try {
      setLoading(true);
      setErr("");

      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        setErr(
          "No se pudo obtener token de sesión. Inicia sesión de nuevo para gestionar usuarios."
        );
        setItems([]);
        setRoleCatalog([]);
        setTotal(0);
        setHasMore(false);
        return;
      }

      const listUsers = requireFn("listUsers");
      const skip = append ? items.length : 0;

      const [resUsers, resRoles] = await Promise.all([
        listUsers(
          {
            q: q.trim(),
            onlyActive: onlyActive ? 1 : 0,
            limit: PAGE_SIZE,
            skip,
            createdFrom: createdFrom || "",
            createdTo: createdTo || "",
          },
          liveToken
        ),
        typeof iamApi.listRoles === "function"
          ? iamApi.listRoles(liveToken)
          : Promise.resolve({}),
      ]);

      if (myReqId !== requestIdRef.current) return;

      const newItems = Array.isArray(resUsers?.items) ? resUsers.items : [];
      const meta = resUsers?.meta || {};

      setItems((prev) => (append ? [...prev, ...newItems] : newItems));

      const totalFromApi = Number(meta.total || 0);
      const hasMoreFromApi =
        typeof meta.hasMore === "boolean" ? meta.hasMore : undefined;

      if (totalFromApi > 0) {
        setTotal(totalFromApi);
      } else {
        setTotal((append ? items.length + newItems.length : newItems.length) || 0);
      }

      if (hasMoreFromApi !== undefined) {
        setHasMore(hasMoreFromApi);
      } else {
        setHasMore(newItems.length === PAGE_SIZE);
      }

      const rolesRaw = resRoles?.items || resRoles?.roles || [];
      setRoleCatalog(Array.isArray(rolesRaw) ? rolesRaw : []);
    } catch (e) {
      if (myReqId !== requestIdRef.current) return;
      setErr(e?.message || "Error al cargar usuarios");
    } finally {
      if (myReqId === requestIdRef.current) setLoading(false);
    }
  }

  async function loadSessions() {
    try {
      setSessionsLoading(true);
      setSessionsErr("");

      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        setSessions([]);
        setSessionsErr("No se pudo obtener token de sesión.");
        return;
      }

      const listSessions = requireFn("listSessions");
      const res = await listSessions({ onlyActive: 1, limit: 100 }, liveToken);
      const list = Array.isArray(res?.items) ? res.items : [];

      setSessions(list);
    } catch (e) {
      setSessions([]);
      setSessionsErr(e?.message || "Error al cargar sesiones");
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadHistory(pageArg = historyPage, { silent = false } = {}) {
    try {
      if (!silent) setHistoryLoading(true);
      setHistoryErr("");

      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        setHistoryItems([]);
        setHistoryAllItems([]);
        setHistoryErr("No se pudo obtener token de sesión.");
        return;
      }

      let normalizedAll = [];

      if (typeof iamApi?.listSessionsHistory === "function") {
        const res = await iamApi.listSessionsHistory(
          { page: 1, limit: 10000, q: historyFilters.q || "" },
          liveToken
        );

        const list = Array.isArray(res?.items) ? res.items : [];
        normalizedAll = list
          .map(normalizeSessionHistoryItem)
          .sort((a, b) => {
            const ta = new Date(a.connectedAt || 0).getTime();
            const tb = new Date(b.connectedAt || 0).getTime();
            return tb - ta;
          });
      } else {
        normalizedAll = (Array.isArray(sessions) ? sessions : [])
          .map(normalizeSessionHistoryItem)
          .sort((a, b) => {
            const ta = new Date(a.connectedAt || 0).getTime();
            const tb = new Date(b.connectedAt || 0).getTime();
            return tb - ta;
          });
      }

      const filtered = filterHistoryItems(normalizedAll, historyFilters);
      const start = (pageArg - 1) * HISTORY_PAGE_SIZE;
      const slice = filtered.slice(start, start + HISTORY_PAGE_SIZE);

      setHistoryAllItems(filtered);
      setHistoryItems(slice);
      setHistoryTotal(filtered.length);
    } catch (e) {
      setHistoryItems([]);
      setHistoryAllItems([]);
      setHistoryErr(e?.message || "Error al cargar historial");
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }

  useEffect(() => {
    load({ append: false });
    loadSessions();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load({ append: false }), 250);
    return () => clearTimeout(t);
  }, [q, onlyActive, createdFrom, createdTo]);

  useEffect(() => {
    const t = setInterval(() => {
      loadSessions();
      if (historyOpen) {
        loadHistory(historyPage, { silent: true });
      }
    }, 30000);

    return () => clearInterval(t);
  }, [historyOpen, historyPage, historyFilters]);

  useEffect(() => {
    if (!historyOpen) return;
    setHistoryPage(1);
  }, [
    historyFilters.q,
    historyFilters.status,
    historyFilters.device,
    historyFilters.dateFrom,
    historyFilters.dateTo,
    historyOpen,
  ]);

  useEffect(() => {
    if (!historyOpen) return;
    loadHistory(historyPage);
  }, [
    historyOpen,
    historyPage,
    historyFilters.q,
    historyFilters.status,
    historyFilters.device,
    historyFilters.dateFrom,
    historyFilters.dateTo,
  ]);

  function validate() {
    const v = {};

    if (!form.nombreCompleto.trim()) v.nombreCompleto = "Requerido";

    if (!form.email.trim()) v.email = "Requerido";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) v.email = "Correo inválido";

    if (!Array.isArray(form.roles) || form.roles.length === 0) {
      v.roles = "Seleccione al menos un rol";
    }

    if (creds.password || creds.confirm) {
      if (!creds.password) v.password = "Debe ingresar contraseña";
      if (!creds.confirm) v.confirm = "Debe confirmar la contraseña";
      if (creds.password !== creds.confirm) {
        v.confirm = "Las contraseñas no coinciden";
      }
      if (!pwdR.length || !pwdR.upper || !pwdR.lower || !pwdR.digit) {
        v.password = "La contraseña no cumple los requisitos mínimos";
      }
    }

    return v;
  }

  function buildPayload() {
    const payload = {
      nombreCompleto: form.nombreCompleto.trim(),
      email: form.email.trim().toLowerCase(),
      roles: Array.isArray(form.roles) ? form.roles : [],
      active: !!form.active,
      mustChangePassword: !!form.forcePwChange,
    };

    if (creds.password) payload.password = creds.password;
    return payload;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const v = validate();
    setErrors(v);

    const keys = Object.keys(v);
    if (keys.length) {
      const firstKey = keys[0];
      const el = document.querySelector(`[name="${firstKey}"]`);
      if (el?.focus) el.focus();
      alert("Corrija los errores del formulario antes de guardar.");
      return;
    }

    try {
      setSubmitting(true);

      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        alert(
          "No se pudo obtener token de sesión. Inicia sesión nuevamente para guardar."
        );
        return;
      }

      const payload = buildPayload();

      if (editing) {
        const updateUser = requireFn("updateUser");
        await updateUser(editing, payload, liveToken);
        alert("Usuario actualizado correctamente");
      } else {
        const createUser = requireFn("createUser");
        await createUser(payload, liveToken);
        alert("Usuario creado correctamente");
      }

      setForm(empty);
      setEditing(null);
      setCreds({ password: "", confirm: "" });
      setErrors({});

      await load({ append: false });
      scrollMainToTop("smooth");
    } catch (e2) {
      alert("Error al guardar: " + (e2?.message || "Revisa la consola"));
      console.error("[UsersPage] submit error:", e2);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u) {
    try {
      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        alert(
          "No se pudo obtener token de sesión. Inicia sesión nuevamente para cambiar estado."
        );
        return;
      }

      if (u.active === false) {
        const enableUser = requireFn("enableUser");
        await enableUser(u._id, liveToken);
      } else {
        const disableUser = requireFn("disableUser");
        await disableUser(u._id, liveToken);
      }

      await load({ append: false });
    } catch (e) {
      alert(e?.message || "No se pudo cambiar el estado");
    }
  }

  async function startEdit(u) {
    setEditing(u._id);
    setCreds({ password: "", confirm: "" });

    scrollMainToTop("smooth");

    setLoading(true);
    let full = u;

    try {
      if (typeof iamApi.getUser === "function") {
        const liveToken = requireTokenSafe();
        const r = await iamApi.getUser(u._id, liveToken);
        full = r?.item || r?.user || r || u;
      }
    } catch (e) {
      console.warn(
        "[UsersPage] no se pudo obtener detalle; usando item de lista:",
        e
      );
    } finally {
      setLoading(false);
    }

    setForm((prev) => ({
      ...prev,
      ...mapUserToFormSafeMini(full),
    }));

    setTimeout(() => firstFieldRef.current?.focus?.(), 120);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setCreds({ password: "", confirm: "" });
    setErrors({});
    scrollMainToTop("smooth");
    setTimeout(() => firstFieldRef.current?.focus?.(), 300);
  }

  async function handleDelete(u) {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar al usuario "${
        u.nombreCompleto || u.name || ""
      }"?`
    );
    if (!ok) return;

    try {
      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        alert(
          "No se pudo obtener token de sesión. Inicia sesión nuevamente para eliminar."
        );
        return;
      }

      if (typeof iamApi.deleteUser === "function") {
        await iamApi.deleteUser(u._id, liveToken);
      } else {
        throw new Error("iamApi.deleteUser no está implementado");
      }

      if (editing === u._id) cancelEdit();
      await load({ append: false });
      alert("Usuario eliminado correctamente.");
    } catch (e) {
      alert(e?.message || "No se pudo eliminar el usuario");
    }
  }

  async function handleKickSession(session) {
    const isCurrent =
      String(session?.sessionId || "").trim() &&
      String(session?.sessionId || "").trim() === currentSessionId;

    const label =
      session?.name || session?.email || session?.sessionId || "esta sesión";

    const msg = isCurrent
      ? `Estás a punto de cerrar tu sesión actual (${label}). Tendrás que volver a iniciar sesión. ¿Deseas continuar?`
      : `¿Cerrar la sesión de "${label}"?`;

    const ok = window.confirm(msg);
    if (!ok) return;

    try {
      setKickingSessionId(session.sessionId);

      const liveToken = requireTokenSafe();
      if (!DISABLE_AUTH && !liveToken) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente.");
        return;
      }

      const kickSession = requireFn("kickSession");
      await kickSession(session.sessionId, liveToken);

      await loadSessions();
      if (historyOpen) await loadHistory(historyPage, { silent: true });

      if (isCurrent) {
        alert("Tu sesión actual fue cerrada. Debes volver a iniciar sesión.");
        try {
          if (typeof iamApi.logout === "function") {
            await iamApi.logout();
          }
        } catch {
          // ignore
        }
        window.location.href = "/login";
        return;
      }

      alert("Sesión cerrada correctamente.");
    } catch (e) {
      alert(e?.message || "No se pudo cerrar la sesión");
    } finally {
      setKickingSessionId("");
    }
  }

  async function openHistory() {
    setHistoryErr("");
    setHistoryPage(1);
    setHistoryOpen(true);
  }

  async function handleExportHistory(format) {
    try {
      const liveToken = requireTokenSafe();

      if (!DISABLE_AUTH && !liveToken) {
        alert("No se pudo obtener token de sesión.");
        return;
      }

      const exportList = Array.isArray(historyAllItems) ? historyAllItems : [];

      if (!exportList.length) {
        alert("No hay registros para exportar con los filtros actuales.");
        return;
      }

      if (format === "csv") {
        exportHistoryCsvLocal(exportList);
        return;
      }

      if (format === "xlsx" || format === "excel") {
        await exportHistoryExcelLocal(exportList);
        return;
      }

      if (format === "pdf") {
        await exportHistoryPdfLocal(exportList);
        return;
      }

      alert("Formato de exportación no soportado.");
    } catch (e) {
      console.error("[UsersPage] export history error:", e);
      alert(e?.message || "No se pudo exportar el historial.");
    }
  }

  const visibleList = items;
  const onlineCount = sessions.filter(
    (s) => String(s.presence).toLowerCase() === "online"
  ).length;

  return (
    <div className="relative space-y-8">
      <div style={sxStickyHead()}>
        <header className="max-w-6xl mx-auto">
          <h1
            className="text-2xl md:text-3xl font-semibold mb-2"
            style={{ color: "var(--text)" }}
          >
            Administración de Usuarios (IAM)
          </h1>
          <p
            className="text-sm max-w-2xl"
            style={{ color: "var(--text-muted)" }}
          >
            Crea y administra usuarios del sistema SENAF: cuentas, roles,
            permisos, sesiones activas y políticas de acceso.
          </p>
          <div style={sxStickyDivider()} />
        </header>
      </div>

      <section
        className="max-w-5xl mx-auto rounded-[24px] p-5 md:p-7 space-y-6"
        style={sxCard()}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2
            className="text-lg md:text-xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            {editing ? "Editar usuario" : "Registrar nuevo usuario"}
          </h2>

          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setCreds({ password: "", confirm: "" });
              setErrors({});
            }}
            style={sxGhostBtn()}
          >
            Limpiar formulario
          </button>
        </div>

        {err && (
          <div
            className="text-sm rounded-lg px-3 py-2"
            style={{
              background: "color-mix(in srgb, #ef4444 10%, transparent)",
              border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)",
              color: "#fca5a5",
            }}
          >
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Nombre
              </label>
              <input
                ref={firstFieldRef}
                name="nombreCompleto"
                value={form.nombreCompleto}
                onChange={(e) => setField("nombreCompleto", e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
                placeholder="Ej. Juan Pérez"
              />
              {errors.nombreCompleto && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.nombreCompleto}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
                placeholder="usuario@dominio.com"
              />
              {errors.email && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Rol(es)
              </label>
              <RoleSelect
                value={form.roles}
                onChange={(val) => setField("roles", val)}
                availableRoles={roleCatalog}
              />
              {errors.roles && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.roles}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Estado
              </label>
              <select
                name="active"
                value={form.active ? "1" : "0"}
                onChange={(e) => setField("active", e.target.value === "1")}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Contraseña{" "}
                <span
                  className="text-xs ml-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  (solo al crear o cambiar)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type={showPwd ? "text" : "password"}
                  value={creds.password}
                  onChange={(e) =>
                    setCreds((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  style={sxGhostBtn({ minHeight: "42px", padding: "0 12px" })}
                >
                  {showPwd ? "Ocultar" : "Ver"}
                </button>
              </div>

              {errors.password && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Confirmar contraseña
              </label>
              <input
                type={showPwd ? "text" : "password"}
                name="confirm"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
                value={creds.confirm}
                onChange={(e) =>
                  setCreds((prev) => ({
                    ...prev,
                    confirm: e.target.value,
                  }))
                }
                placeholder="••••••••"
              />

              {errors.confirm && (
                <span className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.confirm}
                </span>
              )}

              {!errors.confirm && creds.confirm && !match && (
                <span className="text-xs" style={{ color: "#fca5a5" }}>
                  No coincide con la contraseña.
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Seguridad
              </label>

              <label
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <input
                  type="checkbox"
                  checked={!!form.forcePwChange}
                  onChange={(e) => setField("forcePwChange", e.target.checked)}
                />
                Forzar cambio de contraseña
              </label>

              <p
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                Se envía al backend como{" "}
                <span className="font-mono">mustChangePassword</span>.
              </p>
            </div>
          </div>

          {showPwdRules && (
            <div
              className="text-xs rounded-lg px-3 py-2 space-y-1"
              style={sxCardSoft()}
            >
              <div className="font-semibold mb-1" style={{ color: "#67e8f9" }}>
                Requisitos de contraseña:
              </div>
              <div>
                <span style={{ color: pwdR.length ? "#86efac" : "#fca5a5" }}>
                  • Al menos 8 caracteres
                </span>
              </div>
              <div>
                <span style={{ color: pwdR.upper ? "#86efac" : "#fca5a5" }}>
                  • Una letra mayúscula
                </span>
              </div>
              <div>
                <span style={{ color: pwdR.lower ? "#86efac" : "#fca5a5" }}>
                  • Una letra minúscula
                </span>
              </div>
              <div>
                <span style={{ color: pwdR.digit ? "#86efac" : "#fca5a5" }}>
                  • Un número
                </span>
              </div>
              <div>
                <span style={{ color: match ? "#86efac" : "#fca5a5" }}>
                  • Coincidencia entre contraseña y confirmación
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 flex-wrap">
            <button type="button" onClick={cancelEdit} style={sxGhostBtn()}>
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="disabled:opacity-60"
              style={sxPrimaryBtn()}
            >
              {submitting
                ? "Guardando..."
                : editing
                  ? "Guardar cambios"
                  : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start">
          <div>
            <h2
              className="text-lg font-semibold mb-1"
              style={{ color: "var(--text)" }}
            >
              Usuarios registrados
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {items.length} de {total} usuario(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
              style={sxInput({ minHeight: "40px" })}
            />

            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
              style={sxInput({ minHeight: "40px" })}
              title="Desde (creación)"
            />

            <input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
              style={sxInput({ minHeight: "40px" })}
              title="Hasta (creación)"
            />

            <label
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
              Mostrar solo activos
            </label>

            <button
              type="button"
              onClick={() => {
                setQ("");
                setCreatedFrom("");
                setCreatedTo("");
                setOnlyActive(true);
              }}
              title="Quitar filtros"
              style={sxGhostBtn({ minHeight: "40px" })}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div
          className="w-full overflow-x-auto rounded-[24px]"
          style={sxCard()}
        >
          <table
            className="w-full min-w-[1100px] table-fixed text-sm"
            style={{ color: "var(--text)" }}
          >
            <thead
              className="text-xs uppercase"
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                background:
                  "color-mix(in srgb, var(--card-solid) 92%, transparent)",
              }}
            >
              <tr>
                <th className="px-4 py-3 text-left w-[240px]">Nombre</th>
                <th className="px-4 py-3 text-left w-[250px]">Correo</th>
                <th className="px-4 py-3 text-left w-[260px]">Roles</th>
                <th className="px-4 py-3 text-center w-[140px]">Estado</th>
                <th className="px-4 py-3 text-right w-[260px]">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cargando usuarios…
                  </td>
                </tr>
              ) : visibleList.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No hay usuarios que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                visibleList.map((u) => (
                  <tr
                    key={u._id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="min-w-0">
                        <div
                          className="font-medium truncate"
                          style={{ color: "var(--text)" }}
                          title={u.nombreCompleto || u.name || "(Sin nombre)"}
                        >
                          {u.nombreCompleto || u.name || "(Sin nombre)"}
                        </div>
                        <div
                          className="text-[11px] mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Creado:{" "}
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString()
                            : "—"}
                        </div>
                      </div>
                    </td>

                    <td
                      className="px-4 py-4 align-top truncate"
                      style={{ color: "var(--text)" }}
                      title={u.email || u.correoPersona || "—"}
                    >
                      {u.email || u.correoPersona || "—"}
                    </td>

                    <td className="px-4 py-4 align-top">
                      <RoleBadges roles={u.roles} roleLabelMap={roleLabelMap} />
                    </td>

                    <td className="px-4 py-4 text-center align-middle">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={
                          u.active !== false
                            ? {
                                background:
                                  "color-mix(in srgb, #22c55e 12%, transparent)",
                                color: "#15803d",
                                border:
                                  "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
                              }
                            : {
                                background:
                                  "color-mix(in srgb, #ef4444 12%, transparent)",
                                color: "#dc2626",
                                border:
                                  "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
                              }
                        }
                      >
                        <span className="w-2 h-2 rounded-full mr-1 bg-current" />
                        {u.active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-middle">
                      <div className="flex justify-end flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          style={sxTableActionBtn(
                            u.active !== false ? "warning" : "success"
                          )}
                        >
                          {u.active !== false ? "Desactivar" : "Activar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          style={sxTableActionBtn("neutral")}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          style={sxTableActionBtn("danger")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => load({ append: true })}
              disabled={loading}
              className="disabled:opacity-60"
              style={sxGhostBtn()}
            >
              {loading ? "Cargando..." : "Ver más usuarios"}
            </button>
          </div>
        )}
      </section>

      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, #06b6d4 12%, transparent)",
                border: "1px solid color-mix(in srgb, #06b6d4 24%, transparent)",
                color: "#0891b2",
              }}
            >
              <Wifi className="w-5 h-5" />
            </div>

            <div>
              <h2
                className="text-lg font-semibold mb-1"
                style={{ color: "var(--text)" }}
              >
                Usuarios en línea / Sesiones activas
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {onlineCount} en línea, {sessions.length} sesión(es) activa(s)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openHistory}
              style={sxGhostBtn()}
              title="Ver historial de ingresos"
            >
              <History className="w-4 h-4" />
              Historial de ingresos
            </button>

            <button
              type="button"
              onClick={loadSessions}
              disabled={sessionsLoading}
              style={sxGhostBtn()}
            >
              <RefreshCw
                className={`w-4 h-4 ${sessionsLoading ? "animate-spin" : ""}`}
              />
              {sessionsLoading ? "Actualizando..." : "Actualizar sesiones"}
            </button>
          </div>
        </div>

        {sessionsErr && (
          <div
            className="text-sm rounded-lg px-3 py-2"
            style={{
              background: "color-mix(in srgb, #ef4444 10%, transparent)",
              border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)",
              color: "#fca5a5",
            }}
          >
            {sessionsErr}
          </div>
        )}

        <div
          className="w-full overflow-x-auto rounded-[24px]"
          style={sxCard()}
        >
          <table
            className="w-full min-w-[1810px] table-fixed text-sm"
            style={{ color: "var(--text)" }}
          >
            <thead
              className="text-xs uppercase"
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                background:
                  "color-mix(in srgb, var(--card-solid) 92%, transparent)",
              }}
            >
              <tr>
                <th className="px-4 py-3 text-left w-[260px]">Usuario</th>
                <th className="px-4 py-3 text-left w-[160px]">Estado</th>
                <th className="px-4 py-3 text-left w-[190px]">IP</th>
                <th className="px-4 py-3 text-left w-[520px]">Dispositivo</th>
                <th className="px-4 py-3 text-left w-[220px]">Conectado</th>
                <th className="px-4 py-3 text-left w-[220px]">
                  Última actividad
                </th>
                <th className="px-4 py-3 text-right w-[240px]">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {sessionsLoading && sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cargando sesiones…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No hay sesiones activas.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const deviceInfo = summarizeDevice(s);
                  const DeviceIcon = deviceInfo.icon;
                  const isCurrent =
                    String(s?.sessionId || "").trim() &&
                    String(s?.sessionId || "").trim() === currentSessionId;

                  const sameEmail =
                    currentUserEmail &&
                    String(s?.email || "").trim().toLowerCase() ===
                      currentUserEmail;

                  return (
                    <tr
                      key={s._id || s.sessionId}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-4 py-5 align-top">
                        <div className="min-w-0">
                          <div
                            className="font-medium flex items-center gap-2 flex-wrap"
                            style={{ color: "var(--text)" }}
                          >
                            <span
                              className="truncate max-w-[180px]"
                              title={s.name || s.email || "—"}
                            >
                              {s.name || s.email || "—"}
                            </span>

                            {isCurrent ? <CurrentSessionPill /> : null}

                            {!isCurrent && sameEmail ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{
                                  background:
                                    "color-mix(in srgb, #64748b 12%, transparent)",
                                  color: "#475569",
                                  border:
                                    "1px solid color-mix(in srgb, #64748b 32%, transparent)",
                                }}
                              >
                                Misma cuenta
                              </span>
                            ) : null}
                          </div>

                          <div
                            className="text-[11px] mt-1 truncate"
                            style={{ color: "var(--text-muted)" }}
                            title={s.email || "—"}
                          >
                            {s.email || "—"}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-5 align-middle whitespace-nowrap">
                        <PresencePill presence={s.presence || s.status} />
                      </td>

                      <td
                        className="px-4 py-5 align-middle whitespace-nowrap font-medium"
                        title={s.ip || "—"}
                        style={{ color: "var(--text)" }}
                      >
                        {s.ip || "—"}
                      </td>

                      <td className="px-4 py-5 align-top">
                        <div className="flex items-start gap-3 min-w-0">
                          <DeviceIcon
                            className="w-4 h-4 shrink-0 mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          />

                          <div className="min-w-0">
                            <div
                              className="truncate font-medium"
                              title={deviceInfo.label}
                              style={{ color: "var(--text)" }}
                            >
                              {deviceInfo.label}
                            </div>

                            <div
                              className="truncate text-[11px] mt-1"
                              style={{ color: "var(--text-muted)" }}
                              title={s.device || s.userAgent || "—"}
                            >
                              {s.device || s.userAgent || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td
                        className="px-4 py-5 align-top whitespace-normal break-words"
                        style={{ color: "var(--text)" }}
                      >
                        {fmtDateTime(s.connectedAt)}
                      </td>

                      <td
                        className="px-4 py-5 align-top whitespace-normal break-words"
                        style={{ color: "var(--text)" }}
                      >
                        {fmtDateTime(s.lastActivityAt)}
                      </td>

                      <td className="px-4 py-5 align-middle">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleKickSession(s)}
                            disabled={kickingSessionId === s.sessionId}
                            style={sxTableActionBtn("danger")}
                            title={
                              isCurrent
                                ? "Cerrar mi sesión actual"
                                : "Cerrar sesión"
                            }
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            {kickingSessionId === s.sessionId
                              ? "Cerrando..."
                              : isCurrent
                                ? "Cerrar mi sesión"
                                : "Cerrar sesión"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SessionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        historyItems={historyItems}
        historyLoading={historyLoading}
        historyErr={historyErr}
        page={historyPage}
        setPage={setHistoryPage}
        totalHistory={historyTotal}
        onRefresh={() => loadHistory(historyPage)}
        onExportCsv={() => handleExportHistory("csv")}
        onExportExcel={() => handleExportHistory("xlsx")}
        onExportPdf={() => handleExportHistory("pdf")}
        filters={historyFilters}
        setFilters={setHistoryFilters}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <PageErrorBoundary>
      <UsersPageInner />
    </PageErrorBoundary>
  );
}