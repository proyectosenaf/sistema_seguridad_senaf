import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Mic, MicOff, PencilLine } from "lucide-react";

import CameraCapture from "../../components/CameraCapture.jsx";
import VideoRecorder from "../../components/VideoRecorder.jsx";
import AudioRecorder from "../../components/AudioRecorder.jsx";

import api, { API } from "../../lib/api.js";
import iamApi from "../../iam/api/iamApi.js";

import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const USER_KEY = "senaf_user";

/* =========================
   Auth / permisos helpers
========================= */
function safeJSONParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLocalUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return safeJSONParse(raw);
  } catch {
    return null;
  }
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

const LEGACY_PERMISSION_ALIASES = {
  "incidentes.read": "incidentes.records.read",
  "incidentes.create": "incidentes.records.write",
  "incidentes.edit": "incidentes.records.write",
  "incidentes.delete": "incidentes.records.delete",
  "incidentes.close": "incidentes.records.close",
  "incidentes.attach": "incidentes.evidences.write",
  "incidentes.reports": "incidentes.reports.read",
  "incidentes.export": "incidentes.reports.export",

  "visitas.read": "visitas.records.read",
  "visitas.write": "visitas.records.write",
  "visitas.close": "visitas.records.close",
};

function normalizePermissionKey(key) {
  const k = norm(key);
  if (!k) return "";
  return LEGACY_PERMISSION_ALIASES[k] || k;
}

function extractRoles(u) {
  const roles = Array.isArray(u?.roles) ? u.roles : u?.roles ? [u.roles] : [];
  const NS = "https://senaf.local/roles";
  const nsRoles = Array.isArray(u?.[NS]) ? u[NS] : [];

  return [...roles, ...nsRoles]
    .map((r) => {
      if (typeof r === "string") return norm(r);
      if (r && typeof r === "object") {
        return norm(r.code || r.key || r.slug || r.name || r.nombre);
      }
      return "";
    })
    .filter(Boolean);
}

function extractPermissions(u) {
  const direct = Array.isArray(u?.permissions) ? u.permissions : [];
  const permsField = Array.isArray(u?.perms) ? u.perms : [];

  const rolePerms = Array.isArray(u?.roles)
    ? u.roles.flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        return Array.isArray(r.permissions)
          ? r.permissions
          : Array.isArray(r.perms)
          ? r.perms
          : [];
      })
    : [];

  return [
    ...new Set(
      [...direct, ...permsField, ...rolePerms]
        .map((p) => normalizePermissionKey(p))
        .filter(Boolean)
    ),
  ];
}

function hasPermission(user, ...wanted) {
  const perms = extractPermissions(user);
  if (perms.includes("*")) return true;
  return wanted.map(normalizePermissionKey).some((w) => perms.includes(w));
}

function hasRole(user, ...wanted) {
  const roles = extractRoles(user);
  const normalizedWanted = wanted.map(norm).filter(Boolean);
  return normalizedWanted.some((r) => roles.includes(r));
}

/* =========================
   Helpers
========================= */
function guardLabel(g) {
  const name = g?.name || "(Sin nombre)";
  return g?.email ? `${name} — ${g.email}` : name;
}

function buildSelfGuard(user) {
  const id = String(user?._id || user?.id || user?.sub || "").trim();
  const email = String(user?.email || user?.correo || user?.mail || "").trim();
  const name =
    String(
      user?.nombreCompleto ||
        user?.fullName ||
        user?.name ||
        user?.nombre ||
        user?.nickname ||
        ""
    ).trim() || "Guardia";

  return {
    _id: id,
    name,
    email,
    opId: id,
    active: true,
    synthetic: true,
  };
}

function findGuardByAnyId(guards, value) {
  const v = String(value || "").trim();
  if (!v) return null;

  return (
    guards.find((g) => String(g._id || "") === v) ||
    guards.find((g) => String(g.opId || "") === v) ||
    null
  );
}

function matchesCurrentUserGuard(guard, user) {
  const userId = String(user?._id || user?.id || user?.sub || "").trim();
  const userEmail = String(user?.email || "").trim().toLowerCase();

  if (!guard) return false;
  if (userId && (String(guard._id || "") === userId || String(guard.opId || "") === userId)) {
    return true;
  }
  if (userEmail && String(guard.email || "").trim().toLowerCase() === userEmail) {
    return true;
  }
  return false;
}

function toAbsoluteMediaUrl(src, apiHost) {
  const s = String(src || "").trim();
  if (!s) return "";

  if (s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return s;

  const host = String(apiHost || "").replace(/\/$/, "");
  if (!host) return s;

  try {
    if (s.startsWith("/")) return new URL(s, host).toString();
    return new URL(`/${s.replace(/^\/+/, "")}`, host).toString();
  } catch (_) {
    if (s.startsWith("/")) return `${host}${s}`;
    return `${host}/${s.replace(/^\/+/, "")}`;
  }
}

function guessExtFromSrc(src, fallback = "bin") {
  const s = String(src || "");
  const m = s.match(/^data:([^;]+);base64,/);
  if (m?.[1]) {
    const mime = m[1];
    const map = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/webm": "webm",
      "video/mp4": "mp4",
      "video/ogg": "ogv",
      "audio/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };
    return map[mime] || mime.split("/")[1] || fallback;
  }

  try {
    const clean = s.split("?")[0].split("#")[0];
    const ext = clean.split(".").pop();
    if (ext && ext.length <= 6 && ext !== clean) return ext;
  } catch (_) {}

  return fallback;
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = String(dataUrl).split(",");
  const mime =
    meta?.match(/^data:([^;]+);base64$/)?.[1] || "application/octet-stream";

  const bin = atob(b64 || "");
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);

  return new Blob([bytes], { type: mime });
}

async function downloadMedia({ url, rawSrc, filename }) {
  try {
    const src = String(rawSrc || url || "");
    const name = filename || `evidencia_${Date.now()}`;

    if (!src) throw new Error("Fuente vacía");

    if (src.startsWith("data:")) {
      const blob = dataUrlToBlob(src);
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }

    const fileUrl = String(url || src);
    const res = await fetch(fileUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`No se pudo descargar el archivo (${res.status})`);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (e) {
    console.warn("downloadMedia error:", e);
    alert("No se pudo descargar el archivo.");
  }
}

function openMediaInNewTab(src, url, kind = "image") {
  const raw = String(src || url || "").trim();
  const finalUrl = String(url || src || "").trim();

  if (!raw && !finalUrl) {
    alert("No se pudo abrir la evidencia.");
    return;
  }

  try {
    if (raw.startsWith("data:")) {
      const blob = dataUrlToBlob(raw);
      const objectUrl = URL.createObjectURL(blob);
      const win = window.open(objectUrl, "_blank", "noopener,noreferrer");

      if (!win) {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      return;
    }

    const opened = window.open(finalUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      const a = document.createElement("a");
      a.href = finalUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch (e) {
    console.warn("openMediaInNewTab error:", e);
    alert(`No se pudo abrir la evidencia de tipo ${kind}.`);
  }
}

function safeLower(v) {
  return String(v || "").toLowerCase().trim();
}

function normalizeStatus(s) {
  const v = safeLower(s);
  if (v === "en proceso") return "en_proceso";
  return v;
}

function formatStatus(s) {
  if (s === "en_proceso") return "En proceso";
  if (s === "resuelto") return "Resuelto";
  return "Abierto";
}

function getIncidentDate(inc) {
  return inc?.date || inc?.createdAt || null;
}

function parseDateValue(d) {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

function normalizeEvidenceKind(kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (k === "photo" || k === "image") return "photo";
  if (k === "video") return "video";
  if (k === "audio") return "audio";
  return "photo";
}

function mediaTypeFromEvidenceKind(kind) {
  const k = normalizeEvidenceKind(kind);
  if (k === "photo") return "image";
  if (k === "video") return "video";
  if (k === "audio") return "audio";
  return "image";
}

function normalizeIncidentMedia(inc) {
  if (Array.isArray(inc?.evidences) && inc.evidences.length > 0) {
    return inc.evidences
      .filter(Boolean)
      .map((ev) => {
        const src = ev?.base64 || ev?.src || ev?.url || "";
        if (!src) return null;

        return {
          type: mediaTypeFromEvidenceKind(ev?.kind),
          src,
          url: ev?.url || ev?.src || ev?.base64 || "",
          originalName: ev?.originalName || "",
          mimeType: ev?.mimeType || "",
          size: Number(ev?.size || 0),
          uploadedAt: ev?.uploadedAt || null,
        };
      })
      .filter(Boolean);
  }

  const photos = [
    ...(Array.isArray(inc?.photosBase64) ? inc.photosBase64 : []),
    ...(Array.isArray(inc?.photos) ? inc.photos : []),
  ];

  const videos = [
    ...(Array.isArray(inc?.videosBase64) ? inc.videosBase64 : []),
    ...(Array.isArray(inc?.videos) ? inc.videos : []),
  ];

  const audios = [
    ...(Array.isArray(inc?.audiosBase64) ? inc.audiosBase64 : []),
    ...(Array.isArray(inc?.audios) ? inc.audios : []),
  ];

  return [
    ...photos.filter(Boolean).map((src) => ({ type: "image", src, url: src })),
    ...videos.filter(Boolean).map((src) => ({ type: "video", src, url: src })),
    ...audios.filter(Boolean).map((src) => ({ type: "audio", src, url: src })),
  ];
}

/* =========================
   UI styles
========================= */
const UI = {
  page: "space-y-6 layer-content",
  section: "rounded-[24px] overflow-hidden",
  sectionHeader:
    "flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-start lg:justify-between",
  title: "text-2xl font-semibold",
  subtitle: "text-sm",
  btn: "inline-flex items-center justify-center rounded-[14px] px-4 py-2 text-sm font-medium transition-all duration-150",
  btnSm: "inline-flex items-center justify-center rounded-[12px] px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
  input: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition",
  select: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition",
  textarea: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition resize-none",
  label: "block mb-2 font-medium text-sm",
  helper: "text-xs",
};

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

function sxCardStrong(extra = {}) {
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

function sxSectionBar(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--panel) 78%, transparent)",
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
    ...extra,
  };
}

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  };
}

function sxInfoBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #0891b2, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #0891b2 22%, transparent)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxPurpleBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #7c3aed, #ec4899)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #ec4899 22%, transparent)",
    ...extra,
  };
}

function sxOrangeBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #d97706, #f97316)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #f59e0b 22%, transparent)",
    ...extra,
  };
}

function sxBadgePriority(priority) {
  const p = safeLower(priority);
  if (p === "alta") {
    return {
      background: "color-mix(in srgb, #ef4444 12%, transparent)",
      color: "#fca5a5",
      border: "1px solid color-mix(in srgb, #ef4444 42%, transparent)",
    };
  }
  if (p === "media") {
    return {
      background: "color-mix(in srgb, #f59e0b 12%, transparent)",
      color: "#fde68a",
      border: "1px solid color-mix(in srgb, #f59e0b 42%, transparent)",
    };
  }
  return {
    background: "color-mix(in srgb, #22c55e 12%, transparent)",
    color: "#86efac",
    border: "1px solid color-mix(in srgb, #22c55e 42%, transparent)",
  };
}

function sxBadgeStatus(status) {
  const s = normalizeStatus(status);
  if (s === "resuelto") {
    return {
      background: "color-mix(in srgb, #22c55e 12%, transparent)",
      color: "#86efac",
      border: "1px solid color-mix(in srgb, #22c55e 42%, transparent)",
    };
  }
  if (s === "en_proceso") {
    return {
      background: "color-mix(in srgb, #3b82f6 12%, transparent)",
      color: "#93c5fd",
      border: "1px solid color-mix(in srgb, #3b82f6 42%, transparent)",
    };
  }
  return {
    background: "color-mix(in srgb, #ef4444 12%, transparent)",
    color: "#fca5a5",
    border: "1px solid color-mix(in srgb, #ef4444 42%, transparent)",
  };
}

function sxKpi(tone = "default") {
  const tones = {
    danger: {
      border: "color-mix(in srgb, #ef4444 40%, transparent)",
      dot: "#ef4444",
      label: "#fca5a5",
      value: "#f87171",
      glow: "color-mix(in srgb, #ef4444 10%, transparent)",
    },
    info: {
      border: "color-mix(in srgb, #3b82f6 40%, transparent)",
      dot: "#3b82f6",
      label: "#93c5fd",
      value: "#60a5fa",
      glow: "color-mix(in srgb, #3b82f6 10%, transparent)",
    },
    success: {
      border: "color-mix(in srgb, #22c55e 40%, transparent)",
      dot: "#22c55e",
      label: "#86efac",
      value: "#4ade80",
      glow: "color-mix(in srgb, #22c55e 10%, transparent)",
    },
    warning: {
      border: "color-mix(in srgb, #f59e0b 40%, transparent)",
      dot: "#fbbf24",
      label: "#fde68a",
      value: "#fcd34d",
      glow: "color-mix(in srgb, #f59e0b 10%, transparent)",
    },
  };

  const t = tones[tone] || tones.info;

  return {
    background: `linear-gradient(
      to bottom right,
      color-mix(in srgb, var(--card) 88%, transparent),
      color-mix(in srgb, ${t.glow} 50%, var(--card))
    )`,
    border: `1px solid ${t.border}`,
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    "--kpi-dot": t.dot,
    "--kpi-label": t.label,
    "--kpi-value": t.value,
  };
}

function sxViewerShell(extra = {}) {
  return {
    height: "62vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "8px 12px 12px",
    background:
      "radial-gradient(circle at center, rgba(255,255,255,.03), rgba(2,6,23,.22) 55%, rgba(2,6,23,.35) 100%)",
    ...extra,
  };
}

function sxViewerFrame(extra = {}) {
  return {
    width: "100%",
    height: "100%",
    padding: "10px",
    borderRadius: "20px",
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow:
      "0 18px 42px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...extra,
  };
}

function KpiCard({ title, value, tone, dotLabel }) {
  return (
    <div className="rounded-[20px] p-4" style={sxKpi(tone)}>
      <div
        className="text-xs uppercase font-medium flex items-center gap-2"
        style={{ color: "var(--kpi-label)" }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--kpi-dot)" }}
        />
        {dotLabel || title}
      </div>
      <div
        className="text-3xl font-semibold mt-1"
        style={{ color: "var(--kpi-value)" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function IncidentesList() {
  const localUser = useMemo(() => readLocalUser(), []);
  const selfGuard = useMemo(() => buildSelfGuard(localUser), [localUser]);

  const canRead =
    hasPermission(
      localUser,
      "incidentes.records.read",
      "incidentes.reports.read",
      "incidentes.read.any",
      "incidentes.reports.any"
    ) || hasRole(localUser, "admin", "superadmin", "supervisor", "guardia");

  const canCreate =
    hasPermission(
      localUser,
      "incidentes.records.write",
      "incidentes.create.any"
    ) || hasRole(localUser, "admin", "superadmin", "supervisor", "guardia");

  const canUpdateAny =
    hasPermission(localUser, "incidentes.edit.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor");

  const canDeleteAny =
    hasPermission(localUser, "incidentes.delete.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor");

  const canCloseAny =
    hasPermission(localUser, "incidentes.close.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor");

  const canExport =
    hasPermission(localUser, "incidentes.reports.export") ||
    hasRole(localUser, "admin", "superadmin", "supervisor", "administrador_it");

  const canReadReports =
    hasPermission(localUser, "incidentes.reports.read", "incidentes.reports.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor", "administrador_it");

  const isGuardOnly =
    hasRole(localUser, "guardia", "guard", "rondasqr.guard") &&
    !hasRole(localUser, "admin", "superadmin", "supervisor") &&
    !hasPermission(localUser, "incidentes.create.any", "incidentes.edit.any", "incidentes.delete.any");

  const canChangeStatus = canCloseAny || hasPermission(localUser, "incidentes.records.close");

  function canEditIncident(incident) {
    if (canUpdateAny) return true;
    if (!hasPermission(localUser, "incidentes.records.write")) return false;

    const myId = String(localUser?._id || localUser?.id || localUser?.sub || "").trim();
    const myEmail = String(localUser?.email || "").trim().toLowerCase();

    const ownerIds = [
      incident?.createdByUserId,
      incident?.reportedByGuardId,
      incident?.guardId,
      incident?.reportedByUserId,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);

    const ownerEmails = [
      incident?.reportedByGuardEmail,
      incident?.guardEmail,
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    if (myId && ownerIds.includes(myId)) return true;
    if (myEmail && ownerEmails.includes(myEmail)) return true;

    return false;
  }

  function canDeleteIncident(incident) {
    if (canDeleteAny) return true;
    if (!hasPermission(localUser, "incidentes.records.delete")) return false;

    const myId = String(localUser?._id || localUser?.id || localUser?.sub || "").trim();
    const myEmail = String(localUser?.email || "").trim().toLowerCase();

    const ownerIds = [
      incident?.createdByUserId,
      incident?.reportedByGuardId,
      incident?.guardId,
      incident?.reportedByUserId,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);

    const ownerEmails = [
      incident?.reportedByGuardEmail,
      incident?.guardEmail,
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    if (myId && ownerIds.includes(myId)) return true;
    if (myEmail && ownerEmails.includes(myEmail)) return true;

    return false;
  }

  function canCloseIncident(incident) {
    if (canCloseAny) return true;
    if (!hasPermission(localUser, "incidentes.records.close")) return false;
    return canEditIncident(incident);
  }

  const [incidentes, setIncidentes] = useState([]);
  const [stats, setStats] = useState({
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    type: "Acceso no autorizado",
    description: "",
    reportedBy: "",
    reportedByGuardId: "",
    zone: "",
    priority: "alta",
    status: "abierto",
  });

  const [media, setMedia] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);

  const fileInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  const API_HOST = useMemo(() => {
    const raw = String(API || "").trim();
    if (!raw) return "";
    const idx = raw.indexOf("/api");
    return idx >= 0
      ? raw.slice(0, idx).replace(/\/$/, "")
      : raw.replace(/\/$/, "");
  }, []);

  const [guards, setGuards] = useState([]);

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function clearFilters() {
    setQ("");
    setFStatus("all");
    setFPriority("all");
    setDateFrom("");
    setDateTo("");
  }

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [activeEvidenceIdx, setActiveEvidenceIdx] = useState(0);

  function openEvidence(inc) {
    const items = normalizeIncidentMedia(inc).map((item) => {
      const finalUrl = item.src?.startsWith("data:")
        ? item.src
        : toAbsoluteMediaUrl(item.url || item.src, API_HOST);

      return {
        ...item,
        url: finalUrl,
      };
    });

    setEvidenceItems(items);
    setEvidenceTitle(`${inc?.type || "Incidente"} — ${inc?._id || ""}`);
    setActiveEvidenceIdx(0);
    setEvidenceOpen(true);
  }

  function closeEvidence() {
    setEvidenceOpen(false);
    setEvidenceItems([]);
    setEvidenceTitle("");
    setActiveEvidenceIdx(0);
  }

  function nextEvidence() {
    setActiveEvidenceIdx((prev) => Math.min(prev + 1, evidenceItems.length - 1));
  }

  function prevEvidence() {
    setActiveEvidenceIdx((prev) => Math.max(prev - 1, 0));
  }

  const activeEvidence = evidenceItems[activeEvidenceIdx];

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      recognitionRef.current = null;
      return;
    }

    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "es-HN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.warn("[IncidentesList] speech error:", event?.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalTranscript += transcript + " ";
        else interimTranscript += transcript;
      }

      if (finalTranscript.trim()) {
        setForm((prev) => ({
          ...prev,
          description: `${prev.description}${prev.description ? " " : ""}${finalTranscript.trim()}`.trim(),
        }));
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!showForm && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, [showForm]);

  function toggleVoiceDictation() {
    if (!speechSupported || !recognitionRef.current) {
      alert("El dictado por voz no está disponible en este navegador.");
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } catch (err) {
      console.warn("[IncidentesList] toggle voice error:", err);
      alert("No se pudo iniciar el dictado por voz.");
      setIsListening(false);
    }
  }

  function recomputeStats(list) {
    const abiertos = list.filter((i) => normalizeStatus(i.status) === "abierto").length;
    const enProceso = list.filter(
      (i) => normalizeStatus(i.status) === "en_proceso"
    ).length;
    const resueltos = list.filter(
      (i) => normalizeStatus(i.status) === "resuelto"
    ).length;
    const alta = list.filter((i) => safeLower(i.priority) === "alta").length;
    setStats({ abiertos, enProceso, resueltos, alta });
  }

  useEffect(() => {
    if (!canRead) return;

    (async () => {
      try {
        const res = await api.get("/incidentes", { params: { limit: 500 } });

        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.items)
          ? res.data.items
          : [];

        setIncidentes(data);
        recomputeStats(data);
      } catch (err) {
        console.error("Error cargando incidentes", err);
      }
    })();
  }, [canRead]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (isGuardOnly) {
        const mine = selfGuard && (selfGuard._id || selfGuard.email) ? [selfGuard] : [];
        if (!mounted) return;
        setGuards(mine);
        setForm((prev) => ({
          ...prev,
          reportedByGuardId: mine[0]?._id || mine[0]?.opId || "",
          reportedBy: mine[0] ? guardLabel(mine[0]) : "",
        }));
        return;
      }

      try {
        let items = [];

        if (typeof iamApi.listGuardsPicker === "function") {
          const r = await iamApi.listGuardsPicker("", true);
          items = Array.isArray(r?.items) ? r.items : [];
        } else if (typeof iamApi.listGuards === "function") {
          const r = await iamApi.listGuards("", true, undefined);
          items = r.items || r.guards || r.users || [];
        } else if (typeof iamApi.listUsers === "function") {
          const r = await iamApi.listUsers("");
          const raw = Array.isArray(r?.items) ? r.items : [];
          items = raw.filter((u) => {
            const roles = extractRoles(u);
            return (
              roles.includes("guardia") ||
              roles.includes("guard") ||
              roles.includes("rondasqr.guard")
            );
          });
        }

        let normalized = (items || [])
          .filter(Boolean)
          .map((u) => ({
            _id: u._id ? String(u._id) : String(u.id || ""),
            name: u.name || u.nombreCompleto || u.fullName || u.nombre || "",
            email: u.email || u.correo || u.mail || "",
            opId: u.opId || u.sub || u.legacyId || String(u._id || u.id || ""),
            active: u.active !== false,
          }))
          .filter((u) => u.active !== false);

        if (selfGuard && (selfGuard._id || selfGuard.email)) {
          const existsMe = normalized.some((g) => matchesCurrentUserGuard(g, localUser));
          if (!existsMe) normalized = [selfGuard, ...normalized];
        }

        if (mounted) setGuards(normalized);
      } catch (e) {
        console.error("[IncidentesList] listGuards error:", e);
        if (!mounted) return;

        const fallback = selfGuard && (selfGuard._id || selfGuard.email) ? [selfGuard] : [];
        setGuards(fallback);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isGuardOnly, localUser, selfGuard]);

  const availableGuards = useMemo(() => {
    if (!isGuardOnly) return guards;
    const mine = guards.filter((g) => matchesCurrentUserGuard(g, localUser));
    return mine.length ? mine : (selfGuard && (selfGuard._id || selfGuard.email) ? [selfGuard] : []);
  }, [guards, isGuardOnly, localUser, selfGuard]);

  const selectedGuard = useMemo(() => {
    return (
      findGuardByAnyId(availableGuards, form.reportedByGuardId) ||
      availableGuards.find((g) => matchesCurrentUserGuard(g, localUser)) ||
      null
    );
  }, [availableGuards, form.reportedByGuardId, localUser]);

  const actualizarEstado = async (id, nuevoEstado) => {
    const incident = incidentes.find((x) => x._id === id);
    if (!incident || !canCloseIncident(incident)) {
      return alert("No tienes permisos para cambiar el estado de este incidente.");
    }

    try {
      const res = await api.put(`/incidentes/${id}`, { status: nuevoEstado });

      const serverItem = res.data?.item || res.data || {};
      const patch =
        serverItem && Object.keys(serverItem).length > 0
          ? serverItem
          : { status: nuevoEstado };

      setIncidentes((prev) => {
        const next = prev.map((inc) =>
          inc._id === id ? { ...inc, ...patch } : inc
        );
        recomputeStats(next);
        return next;
      });
    } catch (err) {
      console.error("Error actualizando incidente", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.payload?.message ||
        err?.payload?.error ||
        err?.message ||
        "No se pudo actualizar el estado";
      alert(msg);
    }
  };

  const handleFormChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleReporterChange = (e) => {
    const selectedId = e.target.value;
    const g = findGuardByAnyId(guards, selectedId);

    if (isGuardOnly && g && !matchesCurrentUserGuard(g, localUser)) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      reportedByGuardId: selectedId,
      reportedBy: g ? guardLabel(g) : "",
    }));
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const b64 = await fileToBase64(file);
    const isVideo = file.type?.startsWith("video/");
    const isAudio = file.type?.startsWith("audio/");

    setMedia((prev) => [
      ...prev,
      { type: isVideo ? "video" : isAudio ? "audio" : "image", src: b64 },
    ]);
    e.target.value = "";
  };

  const handleCameraCapture = (dataUrl) => {
    setMedia((prev) => [...prev, { type: "image", src: dataUrl }]);
    setShowCamera(false);
  };

  const handleVideoCapture = (dataUrl) => {
    setMedia((prev) => [...prev, { type: "video", src: dataUrl }]);
    setShowVideoRecorder(false);
  };

  const handleAudioCapture = ({ base64 }) => {
    setMedia((prev) => [...prev, { type: "audio", src: base64 }]);
    setShowAudioRecorder(false);
  };

  const removeMedia = (idx) =>
    setMedia((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    const myGuard =
      guards.find((g) => matchesCurrentUserGuard(g, localUser)) ||
      (selfGuard && (selfGuard._id || selfGuard.email) ? selfGuard : null);

    setForm({
      type: "Acceso no autorizado",
      description: "",
      reportedBy: isGuardOnly && myGuard ? guardLabel(myGuard) : "",
      reportedByGuardId:
        isGuardOnly && myGuard ? String(myGuard._id || myGuard.opId || "") : "",
      zone: "",
      priority: "alta",
      status: "abierto",
    });
    setMedia([]);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canCreate) {
      return alert("No tienes permisos para reportar incidentes.");
    }

    const editingIncident = editingId ? incidentes.find((x) => x._id === editingId) : null;
    if (editingIncident && !canEditIncident(editingIncident)) {
      return alert("No tienes permisos para editar este incidente.");
    }

    if (!form.description.trim()) return alert("Describa el incidente.");

    const guard =
      findGuardByAnyId(guards, form.reportedByGuardId) ||
      (isGuardOnly ? selectedGuard : null);

    if (!guard) {
      return alert("Seleccione el guardia que reporta el incidente.");
    }

    if (isGuardOnly && !matchesCurrentUserGuard(guard, localUser)) {
      return alert("Como guardia, solo puedes reportar incidentes a tu propio nombre.");
    }

    try {
      const label = guard ? guardLabel(guard) : form.reportedBy;
      const myId = String(localUser?._id || localUser?.id || localUser?.sub || "").trim();

      const photosBase64 = media
        .filter((m) => m.type === "image")
        .map((m) => m.src);

      const videosBase64 = media
        .filter((m) => m.type === "video")
        .map((m) => m.src);

      const audiosBase64 = media
        .filter((m) => m.type === "audio")
        .map((m) => m.src);

      const evidences = media.map((m) => ({
        kind:
          m.type === "image" ? "photo" : m.type === "video" ? "video" : "audio",
        base64: m.src,
      }));

      const payload = {
        type: form.type,
        description: form.description,
        zone: form.zone,
        priority: form.priority,
        status: normalizeStatus(form.status),
        reportedBy: label,

        reportedByGuardId: guard?._id || form.reportedByGuardId || "",
        reportedByGuardName: guard?.name || "",
        reportedByGuardEmail: guard?.email || "",

        guardId: guard?._id || form.reportedByGuardId || "",
        guardName: guard?.name || "",
        guardEmail: guard?.email || "",

        createdByUserId: myId || "",
        reportedByUserId: myId || "",

        photosBase64,
        videosBase64,
        audiosBase64,
        evidences,
      };

      if (editingId) {
        const res = await api.put(`/incidentes/${editingId}`, payload);
        const actualizado = res.data?.item || res.data || {};
        setIncidentes((prev) => {
          const next = prev.map((i) =>
            i._id === editingId ? { ...i, ...actualizado } : i
          );
          recomputeStats(next);
          return next;
        });
        alert("Se guardaron los cambios.");
      } else {
        const res = await api.post("/incidentes", payload);
        const creado = res.data?.item || res.data;
        setIncidentes((prev) => {
          const next = [creado, ...prev];
          recomputeStats(next);
          return next;
        });
        alert("Incidente guardado correctamente.");
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Error guardando incidente", err);
      console.error("STATUS:", err?.response?.status || err?.status);
      console.error("DATA:", err?.response?.data || err?.payload);

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.payload?.message ||
        err?.payload?.error ||
        err?.message ||
        "No se pudo guardar el incidente";

      alert(msg);
    }
  };

  const startCreate = () => {
    if (!canCreate) {
      return alert("No tienes permisos para crear incidentes.");
    }
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const startEdit = (incidente) => {
    if (!incidente?._id) return;
    if (!canEditIncident(incidente)) {
      return alert("No tienes permisos para editar este incidente.");
    }

    setShowForm(true);
    setEditingId(incidente._id);

    const matchedGuard = findGuardByAnyId(
      guards,
      incidente.guardId || incidente.opId || incidente.reportedByGuardId || ""
    );

    const guardId =
      matchedGuard?._id ||
      incidente.guardId ||
      incidente.opId ||
      incidente.reportedByGuardId ||
      "";

    const reportedByLabel = matchedGuard
      ? guardLabel(matchedGuard)
      : incidente.reportedBy || "";

    setForm({
      type: incidente.type || "Acceso no autorizado",
      description: incidente.description || "",
      reportedBy: reportedByLabel,
      reportedByGuardId: String(guardId),
      zone: incidente.zone || "",
      priority: incidente.priority || "alta",
      status: normalizeStatus(incidente.status || "abierto"),
    });

    setMedia(normalizeIncidentMedia(incidente));
  };

  const handleDelete = async (id) => {
    const incident = incidentes.find((x) => x._id === id);
    if (!incident || !canDeleteIncident(incident)) {
      return alert("No tienes permisos para eliminar este incidente.");
    }

    const ok = window.confirm(
      "¿Seguro que deseas eliminar este incidente? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    try {
      await api.delete(`/incidentes/${id}`);
      setIncidentes((prev) => {
        const next = prev.filter((i) => i._id !== id);
        recomputeStats(next);
        return next;
      });
    } catch (err) {
      console.error("Error eliminando incidente", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.payload?.message ||
        err?.payload?.error ||
        err?.message ||
        "No se pudo eliminar el incidente";
      alert(msg);
    }
  };

  const filtered = useMemo(() => {
    const text = safeLower(q);

    const fromTs = dateFrom ? parseDateValue(dateFrom + "T00:00:00") : null;
    const toTs = dateTo ? parseDateValue(dateTo + "T23:59:59") : null;

    let base = incidentes || [];

    if (!hasPermission(localUser, "incidentes.read.any") && !hasRole(localUser, "admin", "superadmin", "supervisor", "administrador_it")) {
      const myId = String(localUser?._id || localUser?.id || localUser?.sub || "").trim();
      const myEmail = String(localUser?.email || "").trim().toLowerCase();

      base = base.filter((i) => {
        const ownerIds = [
          i?.createdByUserId,
          i?.reportedByGuardId,
          i?.guardId,
          i?.reportedByUserId,
        ]
          .map((v) => String(v || "").trim())
          .filter(Boolean);

        const ownerEmails = [
          i?.reportedByGuardEmail,
          i?.guardEmail,
        ]
          .map((v) => String(v || "").trim().toLowerCase())
          .filter(Boolean);

        if (myId && ownerIds.includes(myId)) return true;
        if (myEmail && ownerEmails.includes(myEmail)) return true;
        return false;
      });
    }

    return base.filter((i) => {
      if (fStatus !== "all" && normalizeStatus(i.status) !== fStatus) return false;
      if (fPriority !== "all" && safeLower(i.priority) !== fPriority) return false;

      const d = getIncidentDate(i);
      const t = d ? parseDateValue(d) : null;
      if (fromTs != null && t != null && t < fromTs) return false;
      if (toTs != null && t != null && t > toTs) return false;

      if (!text) return true;

      const haystack = [
        i.type,
        i.description,
        i.zone,
        i.reportedBy,
        i.guardName,
        i.guardEmail,
        i.status,
        i.priority,
      ]
        .map(safeLower)
        .join(" | ");

      return haystack.includes(text);
    });
  }, [incidentes, q, fStatus, fPriority, dateFrom, dateTo, localUser]);

  const handleExportPDF = () => {
    if (!canExport || !canReadReports) {
      return alert("No tienes permisos para exportar incidentes.");
    }

    if (!filtered.length) return alert("No hay incidentes (filtrados) para exportar.");

    const doc = new jsPDF("l", "pt", "a4");

    const columns = [
      "#",
      "Tipo",
      "Descripción",
      "Reportado por",
      "Zona",
      "Fecha",
      "Prioridad",
      "Estado",
    ];

    const rows = filtered.map((i, idx) => {
      const fecha = getIncidentDate(i)
        ? new Date(getIncidentDate(i)).toLocaleString()
        : "";
      return [
        idx + 1,
        i.type || "",
        i.description || "",
        i.reportedBy || "",
        i.zone || "",
        fecha,
        i.priority || "",
        formatStatus(normalizeStatus(i.status)),
      ];
    });

    doc.setFontSize(14);
    doc.text("Reporte de Incidentes", 40, 30);

    if (typeof doc.autoTable !== "function") {
      alert("autoTable no está disponible. Revisa la importación de jspdf-autotable.");
      return;
    }

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 27, 45] },
    });

    doc.save("incidentes_filtrados.pdf");
  };

  const handleExportExcel = () => {
    if (!canExport || !canReadReports) {
      return alert("No tienes permisos para exportar incidentes.");
    }

    if (!filtered.length) return alert("No hay incidentes (filtrados) para exportar.");

    const data = filtered.map((i, idx) => {
      const fecha = getIncidentDate(i)
        ? new Date(getIncidentDate(i)).toLocaleString()
        : "";

      return {
        "#": idx + 1,
        Tipo: i.type || "",
        Descripción: i.description || "",
        "Reportado por": i.reportedBy || "",
        Zona: i.zone || "",
        Fecha: fecha,
        Prioridad: i.priority || "",
        Estado: formatStatus(normalizeStatus(i.status)),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incidentes");
    XLSX.writeFile(wb, "incidentes_filtrados.xlsx");
  };

  if (!canRead) {
    return (
      <div className={UI.page}>
        <div className="rounded-[24px] p-6 md:p-8" style={sxCard()}>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>
            Acceso restringido
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            No tienes permisos para acceder al módulo de incidentes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={UI.page}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className={UI.title} style={{ color: "var(--text)" }}>
            Gestión de Incidentes
          </h1>
          <p className={UI.subtitle} style={{ color: "var(--text-muted)" }}>
            Registra y da seguimiento a incidentes de seguridad
          </p>
        </div>

        {canCreate && (
          <button
            onClick={showForm ? closeForm : startCreate}
            className={UI.btn}
            style={showForm ? sxDangerBtn() : sxPrimaryBtn()}
          >
            {showForm ? "Cerrar formulario" : "+ Reportar Incidente"}
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <div className="rounded-[24px] p-6 md:p-8 transition-all" style={sxCard()}>
          <h2
            className="text-xl font-semibold mb-6"
            style={{ color: "var(--text)" }}
          >
            {editingId ? "Editar incidente" : "Reportar Nuevo Incidente"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6 text-sm">
            <div>
              <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                Tipo de Incidente
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleFormChange}
                className={UI.select}
                style={sxInput()}
              >
                <option>Acceso no autorizado</option>
                <option>Falla técnica</option>
                <option>Objeto perdido</option>
                <option>Otro</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <label
                  className={UI.label}
                  style={{ color: "var(--text-muted)", marginBottom: 0 }}
                >
                  Descripción del Incidente
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Manual
                  </span>

                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    disabled={!speechSupported}
                    className="inline-flex items-center gap-1 rounded-[12px] px-2.5 py-1 text-xs transition-all duration-150"
                    style={{
                      ...sxGhostBtn(),
                      opacity: speechSupported ? 1 : 0.55,
                      border: isListening
                        ? "1px solid rgba(34, 197, 94, 0.45)"
                        : "1px solid var(--border)",
                      boxShadow: isListening
                        ? "0 0 0 2px rgba(34,197,94,0.12)"
                        : "var(--shadow-sm)",
                    }}
                    title={
                      speechSupported
                        ? isListening
                          ? "Detener dictado"
                          : "Iniciar dictado por voz"
                        : "Dictado por voz no disponible"
                    }
                  >
                    {isListening ? (
                      <MicOff className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                    <span>{isListening ? "Detener" : "Micrófono"}</span>
                  </button>
                </div>
              </div>

              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                className={UI.textarea + " min-h-[110px]"}
                style={sxInput()}
                placeholder="Escriba manualmente o use el micrófono para dictar..."
                required
              />

              <div
                className="mt-2 text-xs"
                style={{
                  color: isListening ? "#22c55e" : "var(--text-muted)",
                }}
              >
                {isListening
                  ? "Escuchando... hable ahora para llenar la descripción del incidente."
                  : speechSupported
                  ? "Puede escribir manualmente o usar dictado por voz."
                  : "Puede escribir manualmente. El dictado por voz no está disponible en este navegador."}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                  Reportado por
                </label>

                {isGuardOnly ? (
                  <input
                    type="text"
                    value={selectedGuard ? guardLabel(selectedGuard) : form.reportedBy}
                    readOnly
                    className={UI.input}
                    style={sxInput({ opacity: 0.95 })}
                    placeholder="Tu usuario guardia"
                  />
                ) : (
                  <select
                    name="reportedByGuardId"
                    value={form.reportedByGuardId}
                    onChange={handleReporterChange}
                    className={UI.select}
                    style={sxInput()}
                    required
                  >
                    <option value="">Seleccione un guardia…</option>
                    {availableGuards.map((g) => (
                      <option key={g._id || g.opId} value={g._id || g.opId}>
                        {guardLabel(g)}
                      </option>
                    ))}
                  </select>
                )}

                {isGuardOnly && (
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Como usuario guardia, el incidente queda reportado automáticamente a tu nombre.
                  </p>
                )}
              </div>

              <div>
                <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                  Zona / Ubicación
                </label>
                <input
                  name="zone"
                  value={form.zone}
                  onChange={handleFormChange}
                  className={UI.input}
                  style={sxInput()}
                  placeholder="Ej. Entrada Principal / Comayagua / Sala Juntas A"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                  Prioridad
                </label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleFormChange}
                  className={UI.select}
                  style={sxInput()}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              {!isGuardOnly && canChangeStatus && (
                <div>
                  <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                    Estado
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                    className={UI.select}
                    style={sxInput()}
                  >
                    <option value="abierto">Abierto</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="resuelto">Resuelto</option>
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                Evidencias (fotos / videos / audio)
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={UI.btn}
                  style={sxInfoBtn()}
                >
                  📁 Seleccionar archivo
                </button>

                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className={UI.btn}
                  style={sxPrimaryBtn()}
                >
                  📷 Tomar foto
                </button>

                <button
                  type="button"
                  onClick={() => setShowVideoRecorder(true)}
                  className={UI.btn}
                  style={sxPurpleBtn()}
                >
                  🎥 Grabar video
                </button>

                <button
                  type="button"
                  onClick={() => setShowAudioRecorder(true)}
                  className={UI.btn}
                  style={sxOrangeBtn()}
                >
                  🎙️ Grabar audio
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFile}
                className="hidden"
              />

              {media.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {media.map((item, idx) => (
                    <div
                      key={idx}
                      className={
                        "relative rounded-[14px] overflow-hidden " +
                        (item.type === "audio"
                          ? "w-72 h-12 p-2 flex items-center"
                          : "w-28 h-28")
                      }
                      style={sxCardStrong({
                        background:
                          "color-mix(in srgb, var(--card-solid) 70%, transparent)",
                      })}
                    >
                      {item.type === "image" ? (
                        <img
                          src={item.src}
                          alt={`evidencia-${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : item.type === "video" ? (
                        <video
                          src={item.src}
                          className="w-full h-full object-cover"
                          controls
                        />
                      ) : (
                        <audio src={item.src} controls className="w-full" />
                      )}

                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center"
                        title="Quitar"
                        style={{
                          background: "rgba(2,6,23,.72)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,.12)",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                className={UI.btn}
                style={sxGhostBtn()}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={UI.btn}
                style={sxSuccessBtn()}
              >
                {editingId ? "Guardar cambios" : "Guardar incidente"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Incidentes Abiertos"
          value={stats.abiertos}
          tone="danger"
          dotLabel="Incidentes Abiertos"
        />
        <KpiCard
          title="En Proceso"
          value={stats.enProceso}
          tone="info"
          dotLabel="En Proceso"
        />
        <KpiCard
          title="Resueltos"
          value={stats.resueltos}
          tone="success"
          dotLabel="Resueltos"
        />
        <KpiCard
          title="Alta prioridad"
          value={stats.alta}
          tone="warning"
          dotLabel="Alta prioridad"
        />
      </div>

      <div className={UI.section} style={sxCard()}>
        <div className={UI.sectionHeader} style={sxSectionBar()}>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text)" }}>
              Lista de Incidentes
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Historial de reportes registrados en el sistema
            </p>
          </div>

          <div className="w-full lg:w-[620px] flex flex-col gap-2">
            <input
              className={UI.input}
              style={sxInput()}
              placeholder="Buscar (tipo, descripción, zona, reportado por, estado, prioridad...)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="flex flex-wrap gap-2 items-center justify-end">
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
                className={UI.select + " !w-auto text-xs"}
                style={sxInput()}
                title="Estado"
              >
                <option value="all">Estado: Todos</option>
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En proceso</option>
                <option value="resuelto">Resuelto</option>
              </select>

              <select
                value={fPriority}
                onChange={(e) => setFPriority(e.target.value)}
                className={UI.select + " !w-auto text-xs"}
                style={sxInput()}
                title="Prioridad"
              >
                <option value="all">Prioridad: Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={UI.input + " !w-auto text-xs"}
                style={sxInput()}
                title="Desde"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={UI.input + " !w-auto text-xs"}
                style={sxInput()}
                title="Hasta"
              />

              <button
                type="button"
                onClick={clearFilters}
                className={UI.btnSm}
                style={sxGhostBtn()}
              >
                Limpiar
              </button>

              {canExport && canReadReports && (
                <>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className={UI.btnSm}
                    style={sxPrimaryBtn()}
                  >
                    Exportar PDF
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className={UI.btnSm}
                    style={sxSuccessBtn()}
                  >
                    Exportar Excel
                  </button>
                </>
              )}
            </div>

            <div
              className="text-[11px] text-right"
              style={{ color: "var(--text-muted)" }}
            >
              Mostrando{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {filtered.length}
              </span>{" "}
              de{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {incidentes.length}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead style={sxSectionBar()}>
              <tr className="uppercase text-xs">
                <th className="px-4 py-3 font-medium">TIPO</th>
                <th className="px-4 py-3 font-medium">DESCRIPCIÓN</th>
                <th className="px-4 py-3 font-medium">REPORTADO POR</th>
                <th className="px-4 py-3 font-medium">ZONA</th>
                <th className="px-4 py-3 font-medium">FECHA</th>
                <th className="px-4 py-3 font-medium">PRIORIDAD</th>
                <th className="px-4 py-3 font-medium">ESTADO</th>
                <th className="px-4 py-3 font-medium">EVIDENCIAS</th>
                <th className="px-4 py-3 font-medium text-right">ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No hay incidentes con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => {
                  const mediaItems = normalizeIncidentMedia(i);
                  const photos = mediaItems.filter((m) => m.type === "image");
                  const videos = mediaItems.filter((m) => m.type === "video");
                  const audios = mediaItems.filter((m) => m.type === "audio");
                  const total = mediaItems.length;

                  const d = getIncidentDate(i);
                  const fecha = d ? new Date(d).toLocaleString() : "—";

                  const allowEdit = canEditIncident(i);
                  const allowDelete = canDeleteIncident(i);
                  const allowClose = canCloseIncident(i);

                  return (
                    <tr
                      key={i._id}
                      className="transition-colors"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <td
                        className="px-4 py-3 font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {i.type}
                      </td>
                      <td
                        className="px-4 py-3 max-w-[320px] truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {i.description}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                        {i.reportedBy}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                        {i.zone}
                      </td>

                      <td
                        className="px-4 py-3 whitespace-nowrap text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {fecha}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide"
                          style={sxBadgePriority(i.priority)}
                        >
                          {i.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide"
                          style={sxBadgeStatus(i.status)}
                        >
                          {formatStatus(normalizeStatus(i.status))}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {total ? (
                          <button
                            type="button"
                            onClick={() => openEvidence(i)}
                            className="inline-flex items-center gap-2 text-xs underline underline-offset-4"
                            style={{ color: "#93c5fd" }}
                            title="Ver evidencias"
                          >
                            {photos.length ? <span>📷 {photos.length}</span> : null}
                            {videos.length ? <span>🎥 {videos.length}</span> : null}
                            {audios.length ? <span>🎙️ {audios.length}</span> : null}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {allowClose && normalizeStatus(i.status) === "abierto" && (
                          <button
                            onClick={() => actualizarEstado(i._id, "en_proceso")}
                            className={UI.btnSm}
                            style={sxInfoBtn()}
                          >
                            Procesar
                          </button>
                        )}

                        {allowClose && normalizeStatus(i.status) === "en_proceso" && (
                          <button
                            onClick={() => actualizarEstado(i._id, "resuelto")}
                            className={UI.btnSm}
                            style={sxSuccessBtn()}
                          >
                            Resolver
                          </button>
                        )}

                        {allowEdit && (
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            className={UI.btnSm}
                            style={sxPrimaryBtn()}
                          >
                            Editar
                          </button>
                        )}

                        {allowDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(i._id)}
                            className={UI.btnSm}
                            style={sxDangerBtn()}
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        <Link
          to="/"
          className="underline-offset-4 transition-colors hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Volver al panel principal
        </Link>
      </div>

      {evidenceOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{
            background: "rgba(2, 6, 23, 0.8)",
            backdropFilter: "blur(4px)",
          }}
          onClick={closeEvidence}
        >
          <div
            className="relative z-[201] w-full max-w-6xl rounded-[24px] overflow-hidden lg:ml-[300px] lg:mr-6"
            style={sxCard({
              background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
            })}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 flex items-center justify-between gap-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Evidencias
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {evidenceTitle}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!activeEvidence || activeEvidenceIdx === 0}
                  onClick={prevEvidence}
                  className={UI.btnSm}
                  style={
                    activeEvidenceIdx === 0
                      ? { ...sxGhostBtn(), opacity: 0.5, cursor: "not-allowed" }
                      : sxGhostBtn()
                  }
                >
                  ◀ Anterior
                </button>

                <button
                  type="button"
                  disabled={
                    !activeEvidence || activeEvidenceIdx === evidenceItems.length - 1
                  }
                  onClick={nextEvidence}
                  className={UI.btnSm}
                  style={
                    activeEvidenceIdx === evidenceItems.length - 1
                      ? { ...sxGhostBtn(), opacity: 0.5, cursor: "not-allowed" }
                      : sxGhostBtn()
                  }
                >
                  Siguiente ▶
                </button>

                <button
                  type="button"
                  onClick={closeEvidence}
                  className={UI.btnSm}
                  style={sxDangerBtn()}
                >
                  Cerrar ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
              <div className="p-4">
                {!activeEvidence ? (
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No hay evidencias.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {activeEvidence.type.toUpperCase()} #{activeEvidenceIdx + 1} de{" "}
                        {evidenceItems.length}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openMediaInNewTab(
                              activeEvidence.src,
                              activeEvidence.url,
                              activeEvidence.type
                            )
                          }
                          className={UI.btnSm}
                          style={sxGhostBtn()}
                        >
                          Abrir ↗
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const ext = guessExtFromSrc(
                              activeEvidence.src,
                              activeEvidence.type === "image"
                                ? "png"
                                : activeEvidence.type === "video"
                                ? "webm"
                                : "webm"
                            );
                            const filename = `evidencia_${activeEvidence.type}_${
                              activeEvidenceIdx + 1
                            }.${ext}`;
                            downloadMedia({
                              url: activeEvidence.url,
                              rawSrc: activeEvidence.src,
                              filename,
                            });
                          }}
                          className={UI.btnSm}
                          style={sxSuccessBtn()}
                        >
                          Descargar ⬇
                        </button>
                      </div>
                    </div>

                    <div
                      className="rounded-[18px] overflow-hidden"
                      style={sxCardStrong({
                        background: "rgba(2,6,23,.45)",
                      })}
                    >
                      {activeEvidence.type === "image" ? (
                        <div style={sxViewerShell()}>
                          <div style={sxViewerFrame()}>
                            <img
                              src={activeEvidence.url}
                              alt="evidencia"
                              className="block object-contain"
                              style={{
                                maxWidth: "100%",
                                maxHeight: "calc(62vh - 36px)",
                                borderRadius: "14px",
                              }}
                            />
                          </div>
                        </div>
                      ) : activeEvidence.type === "video" ? (
                        <div style={sxViewerShell()}>
                          <div style={sxViewerFrame()}>
                            <video
                              src={activeEvidence.url}
                              controls
                              className="block object-contain"
                              style={{
                                maxWidth: "100%",
                                maxHeight: "calc(62vh - 36px)",
                                borderRadius: "14px",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={sxViewerShell()}>
                          <div
                            style={sxViewerFrame({
                              width: "min(820px, 100%)",
                              padding: "18px",
                            })}
                          >
                            <audio
                              src={activeEvidence.url}
                              controls
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div
                className="p-3 border-l"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in srgb, var(--panel) 30%, transparent)",
                }}
              >
                <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                  Miniaturas
                </div>
                <div className="space-y-2 max-h-[78vh] overflow-auto pr-1">
                  {evidenceItems.map((m, idx) => {
                    const active = idx === activeEvidenceIdx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveEvidenceIdx(idx)}
                        className="w-full text-left rounded-[16px] p-2 transition"
                        style={
                          active
                            ? {
                                ...sxCardStrong(),
                                background:
                                  "color-mix(in srgb, #06b6d4 12%, var(--card-solid))",
                                border:
                                  "1px solid color-mix(in srgb, #06b6d4 42%, transparent)",
                              }
                            : sxCardStrong()
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-16 h-12 rounded-lg overflow-hidden flex items-center justify-center"
                            style={sxCardStrong({
                              background: "rgba(2,6,23,.4)",
                            })}
                          >
                            {m.type === "image" ? (
                              <div className="w-full h-full flex items-center justify-center p-1">
                                <img
                                  src={m.url}
                                  alt=""
                                  className="max-w-full max-h-full object-contain block rounded-md"
                                />
                              </div>
                            ) : (
                              <div className="text-lg">
                                {m.type === "video" ? "🎥" : "🎙️"}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                              {m.type.toUpperCase()} #{idx + 1}
                            </div>
                            <div
                              className="text-[11px] truncate"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {String(m.src || "").startsWith("data:")
                                ? "Capturado (base64)"
                                : m.url}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
      {showVideoRecorder && (
        <VideoRecorder
          onCapture={handleVideoCapture}
          onClose={() => setShowVideoRecorder(false)}
        />
      )}
      {showAudioRecorder && (
        <AudioRecorder
          onCapture={handleAudioCapture}
          onClose={() => setShowAudioRecorder(false)}
        />
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}