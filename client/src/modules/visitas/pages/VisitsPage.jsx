import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import NewVisitorModal from "../components/NewVisitorModal.jsx";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";

// 🔹 BASE DEL BACKEND
const ROOT = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api"
).replace(/\/$/, "");

// 🔹 ENDPOINTS
const VISITAS_API_URL = `${ROOT}/visitas/v1/visitas`;
const CITAS_API_URL = `${ROOT}/citas`;

const STORAGE_KEY = "visitas_demo";
const CITA_STORAGE_KEY = "citas_demo";
const QR_PREFIX = "SENAF_CITA_QR::";

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeDoc(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeRoleName(v) {
  return String(v || "").trim().toLowerCase();
}

function resolveAuthPrincipal(auth) {
  const raw = auth?.me || auth?.user || null;
  if (!raw || typeof raw !== "object") return null;

  const nestedRoles = Array.isArray(raw.user?.roles) ? raw.user.roles : [];
  const directRoles = Array.isArray(raw.roles) ? raw.roles : [];
  const role =
    raw.role ||
    raw.rol ||
    raw.user?.role ||
    raw.user?.rol ||
    raw.profile?.role ||
    raw.profile?.rol ||
    "";

  const roles = [...directRoles, ...nestedRoles, role].filter(Boolean);

  const email =
    normalizeEmail(raw.email) ||
    normalizeEmail(raw.user?.email) ||
    normalizeEmail(raw.profile?.email) ||
    "";

  const document =
    normalizeDoc(raw.documento) ||
    normalizeDoc(raw.document) ||
    normalizeDoc(raw.dni) ||
    normalizeDoc(raw.user?.documento) ||
    normalizeDoc(raw.user?.document) ||
    normalizeDoc(raw.user?.dni) ||
    "";

  const roleSet = new Set(roles.map((r) => normalizeRoleName(r)));

  const hint = (() => {
    try {
      return localStorage.getItem("senaf_is_visitor") === "1";
    } catch {
      return false;
    }
  })();

  return {
    raw,
    email,
    document,
    roles,
    isVisitor:
      hint ||
      roleSet.has("visita") ||
      roleSet.has("visitor") ||
      roleSet.has("visitante"),
  };
}

function citaBelongsToVisitor(cita, principal) {
  const email = normalizeEmail(principal?.email);
  const doc = normalizeDoc(principal?.document);

  const candidateEmails = [
    cita?.correo,
    cita?.email,
    cita?.visitorEmail,
    cita?.visitanteEmail,
    cita?.createdByEmail,
    cita?.solicitanteEmail,
    cita?.userEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const candidateDocs = [
    cita?.documento,
    cita?.document,
    cita?.dni,
    cita?.createdByDocument,
  ]
    .map(normalizeDoc)
    .filter(Boolean);

  if (email && candidateEmails.includes(email)) return true;
  if (doc && candidateDocs.includes(doc)) return true;

  return false;
}

function visitaBelongsToVisitor(visita, principal) {
  const email = normalizeEmail(principal?.email);
  const doc = normalizeDoc(principal?.document);

  const candidateEmails = [
    visita?.email,
    visita?.correo,
    visita?.visitorEmail,
    visita?.visitanteEmail,
    visita?.createdByEmail,
    visita?.userEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const candidateDocs = [visita?.documento, visita?.document, visita?.dni]
    .map(normalizeDoc)
    .filter(Boolean);

  if (email && candidateEmails.includes(email)) return true;
  if (doc && candidateDocs.includes(doc)) return true;

  return false;
}

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

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
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

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
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

function sxKpi(tone = "default") {
  const tones = {
    success: {
      border: "color-mix(in srgb, #22c55e 40%, transparent)",
      dot: "#22c55e",
      label: "#86efac",
      value: "#4ade80",
      glow: "color-mix(in srgb, #22c55e 10%, transparent)",
    },
    info: {
      border: "color-mix(in srgb, #3b82f6 40%, transparent)",
      dot: "#3b82f6",
      label: "#93c5fd",
      value: "#60a5fa",
      glow: "color-mix(in srgb, #3b82f6 10%, transparent)",
    },
    purple: {
      border: "color-mix(in srgb, #a855f7 40%, transparent)",
      dot: "#a855f7",
      label: "#d8b4fe",
      value: "#c084fc",
      glow: "color-mix(in srgb, #a855f7 10%, transparent)",
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

function KpiCard({ title, value, icon, tone }) {
  return (
    <div className="rounded-[20px] p-4 flex flex-col gap-1" style={sxKpi(tone)}>
      <div
        className="text-sm flex items-center gap-2"
        style={{ color: "var(--kpi-label)" }}
      >
        <span>{icon}</span>
        {title}
      </div>
      <div
        className="text-2xl font-semibold"
        style={{ color: "var(--kpi-value)" }}
      >
        {value}
      </div>
    </div>
  );
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function normalizeCitaEstado(value) {
  const raw = String(value || "").trim();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw.toLowerCase()] || raw || "Programada";
}

function prettyCitaEstado(value) {
  const estado = normalizeCitaEstado(value);

  switch (estado) {
    case "Programada":
      return "programada";
    case "En revisión":
      return "en revisión";
    case "Autorizada":
      return "autorizada";
    case "Denegada":
      return "denegada";
    case "Cancelada":
      return "cancelada";
    case "Dentro":
      return "ingresada";
    case "Finalizada":
      return "finalizada";
    default:
      return String(estado || "programada").toLowerCase();
  }
}

function CitaEstadoPill({ estado }) {
  const normalized = normalizeCitaEstado(estado);
  const val = prettyCitaEstado(normalized);

  let style = {
    background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    color: "#fde68a",
    border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
  };

  switch (normalized) {
    case "Programada":
      style = {
        background: "color-mix(in srgb, #f59e0b 12%, transparent)",
        color: "#fde68a",
        border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
      };
      break;
    case "En revisión":
      style = {
        background: "color-mix(in srgb, #3b82f6 12%, transparent)",
        color: "#93c5fd",
        border: "1px solid color-mix(in srgb, #3b82f6 36%, transparent)",
      };
      break;
    case "Autorizada":
      style = {
        background: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
      };
      break;
    case "Dentro":
      style = {
        background: "color-mix(in srgb, #16a34a 14%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #16a34a 36%, transparent)",
      };
      break;
    case "Denegada":
      style = {
        background: "color-mix(in srgb, #ef4444 12%, transparent)",
        color: "#fca5a5",
        border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
      };
      break;
    case "Cancelada":
    case "Finalizada":
      style = {
        background: "color-mix(in srgb, #64748b 18%, transparent)",
        color: "#cbd5e1",
        border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
      };
      break;
    default:
      break;
  }

  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center justify-center"
      style={style}
    >
      {val}
    </span>
  );
}

function stripDiacritics(str) {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function normalizeQrPayloadValue(payload) {
  if (payload == null) return "";

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return "";
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }

  if (typeof payload === "object") {
    const json = safeJsonStringify(payload);
    return json.trim();
  }

  const primitive = String(payload).trim();
  if (!primitive || primitive === "[object Object]") return "";
  return primitive;
}

function buildQrValueForCita(cita) {
  if (!cita) return "";

  if (cita.qrToken && String(cita.qrToken).trim()) {
    return `${QR_PREFIX}${String(cita.qrToken).trim()}`;
  }

  const normalizedQrPayload = normalizeQrPayloadValue(cita.qrPayload);
  if (normalizedQrPayload) {
    return stripDiacritics(normalizedQrPayload);
  }

  const nombre = cita.nombre || cita.visitante || "Visitante";
  const documento = cita.documento || "No especificado";
  const empresa = cita.empresa || "—";
  const empleado = cita.empleado || "—";
  const motivo = cita.motivo || "—";

  let fecha = "—";
  let hora = "—";

  if (cita.citaAt instanceof Date && !Number.isNaN(cita.citaAt.getTime())) {
    fecha = cita.citaAt.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    hora = cita.citaAt.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    if (cita.fecha) fecha = cita.fecha;
    if (cita.hora) hora = cita.hora;
  }

  const estadoLegible = prettyCitaEstado(cita.estado);

  const text = [
    "INVITACION DE VISITA",
    "------------------------",
    `Visitante: ${nombre}`,
    `Documento: ${documento}`,
    `Empresa: ${empresa}`,
    `Visita a: ${empleado}`,
    `Motivo: ${motivo}`,
    `Fecha: ${fecha}`,
    `Hora: ${hora}`,
    `Estado: ${estadoLegible}`,
  ].join("\n");

  return stripDiacritics(text);
}

function getRenderableQrValue(cita) {
  const value = buildQrValueForCita(cita);
  return typeof value === "string" ? value.trim() : "";
}

function saveToStorage(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[visitas] no se pudo guardar en localStorage:", e);
  }
}

function saveCitasToStorage(next) {
  try {
    localStorage.setItem(CITA_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[citas] no se pudieron guardar en localStorage:", e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((v) => ({
      ...v,
      entryAt: v.entryAt ? new Date(v.entryAt) : null,
      exitAt: v.exitAt ? new Date(v.exitAt) : null,
      kind: v.kind || "Presencial",
    }));
  } catch (e) {
    console.warn("[visitas] no se pudo leer de localStorage:", e);
    return [];
  }
}

function loadCitasFromStorage() {
  try {
    const raw = localStorage.getItem(CITA_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    return arr.map((c, idx) => {
      const baseId = c._id || c.id || `local-cita-${idx}`;
      let citaAt = null;

      if (c.citaAt) {
        citaAt = new Date(c.citaAt);
      } else if (c.fecha && c.hora) {
        citaAt = new Date(`${c.fecha}T${c.hora}:00`);
      }

      return {
        ...c,
        _id: baseId,
        id: baseId,
        citaAt,
        estado: normalizeCitaEstado(c.estado),
      };
    });
  } catch (e) {
    console.warn("[citas] no se pudo leer de localStorage:", e);
    return [];
  }
}

function normalizeVisitFromServer(v) {
  const id = v?._id || v?.id || `local-${Date.now()}-${Math.random()}`;
  const entryAt = v?.fechaEntrada
    ? new Date(v.fechaEntrada)
    : v?.entryAt
    ? new Date(v.entryAt)
    : null;
  const exitAt = v?.fechaSalida
    ? new Date(v.fechaSalida)
    : v?.exitAt
    ? new Date(v.exitAt)
    : null;
  const vehiculo = v?.vehiculo || null;

  const vehicleBrand = vehiculo?.marca || vehiculo?.brand || v?.vehicleBrand || "";
  const vehicleModel = vehiculo?.modelo || vehiculo?.model || v?.vehicleModel || "";
  const vehiclePlate = vehiculo?.placa || vehiculo?.plate || v?.vehiclePlate || "";

  const vehicleSummary =
    vehicleBrand || vehicleModel || vehiclePlate
      ? `${vehicleBrand || "N/D"}${vehicleModel ? ` ${vehicleModel}` : ""}${
          vehiclePlate ? ` (${vehiclePlate})` : ""
        }`
      : "—";

  return {
    id,
    _id: id,
    kind: v?.tipo || v?.kind || "Presencial",
    name: v?.nombre || v?.name || "",
    document: v?.documento || v?.document || v?.dni || "",
    company: v?.empresa || v?.company || "—",
    employee: v?.empleado || v?.employee || "—",
    phone: v?.telefono || v?.phone || "",
    email: v?.correo || v?.email || "",
    reason: v?.motivo || v?.reason || "",
    entry:
      entryAt && !Number.isNaN(entryAt.getTime())
        ? `${entryAt.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          })}, ${entryAt.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "—",
    exit:
      exitAt && !Number.isNaN(exitAt.getTime())
        ? `${exitAt.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          })}, ${exitAt.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "-",
    status: v?.estado || v?.status || "Dentro",
    entryAt,
    exitAt,
    vehicleBrand,
    vehicleModel,
    vehiclePlate,
    vehicleSummary,
    raw: v,
  };
}

function normalizeCitaFromServer(c, index = 0) {
  const id = c?._id || c?.id || `server-cita-${index}`;
  let citaAt = null;

  if (c?.citaAt) {
    citaAt = new Date(c.citaAt);
  } else if (c?.fecha && c?.hora) {
    citaAt = new Date(`${c.fecha}T${c.hora}:00`);
  }

  return {
    ...c,
    _id: id,
    id,
    citaAt,
    estado: normalizeCitaEstado(c?.estado),
    qrDataUrl: c?.qrDataUrl || "",
    qrPayload: c?.qrPayload ?? "",
    qrToken: c?.qrToken || "",
  };
}

function mergeVisitLists(serverList, localList) {
  const map = new Map();

  for (const item of localList) {
    map.set(item.id, item);
  }

  for (const item of serverList) {
    map.set(item.id, {
      ...(map.get(item.id) || {}),
      ...item,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const da = a.entryAt instanceof Date ? a.entryAt.getTime() : 0;
    const db = b.entryAt instanceof Date ? b.entryAt.getTime() : 0;
    return db - da;
  });
}

function mergeCitaLists(serverList, localList) {
  const map = new Map();

  for (const item of localList) {
    map.set(item._id, item);
  }

  for (const item of serverList) {
    const prev = map.get(item._id) || {};
    map.set(item._id, {
      ...prev,
      ...item,
      qrDataUrl: item.qrDataUrl || prev.qrDataUrl || "",
      qrPayload: item.qrPayload ?? prev.qrPayload ?? "",
      qrToken: item.qrToken || prev.qrToken || "",
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const da = a.citaAt instanceof Date ? a.citaAt.getTime() : 0;
    const db = b.citaAt instanceof Date ? b.citaAt.getTime() : 0;
    return da - db;
  });
}

export default function VisitsPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const principal = useMemo(() => resolveAuthPrincipal(auth), [auth]);
  const isVisitor = !!principal?.isVisitor;

  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingExit, setSavingExit] = useState(null);
  const [savingCitaAction, setSavingCitaAction] = useState(null);

  const [onlineCitas, setOnlineCitas] = useState([]);
  const [qrCita, setQrCita] = useState(null);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [viewMode, setViewMode] = useState("citas");

  const loadAllData = useCallback(async () => {
    setLoading(true);

    try {
      const localVisits = loadFromStorage();
      const localCitas = loadCitasFromStorage();

      let serverVisits = [];
      let serverCitas = [];

      try {
        const visitasRes = await fetch(VISITAS_API_URL);
        const visitasData = await visitasRes.json().catch(() => ({}));
        if (visitasRes.ok && Array.isArray(visitasData?.items)) {
          serverVisits = visitasData.items.map(normalizeVisitFromServer);
        }
      } catch (err) {
        console.warn("[visitas] no se pudo leer backend:", err);
      }

      try {
        const citasRes = await fetch(CITAS_API_URL);
        const citasData = await citasRes.json().catch(() => ({}));
        if (citasRes.ok && Array.isArray(citasData?.items)) {
          serverCitas = citasData.items.map((c, idx) =>
            normalizeCitaFromServer(c, idx)
          );
        }
      } catch (err) {
        console.warn("[citas] no se pudo leer backend:", err);
      }

      const nextVisitors = mergeVisitLists(serverVisits, localVisits);
      const nextCitas = mergeCitaLists(serverCitas, localCitas);

      setVisitors(nextVisitors);
      setOnlineCitas(nextCitas);

      saveToStorage(nextVisitors);
      saveCitasToStorage(
        nextCitas.map((c) => ({
          ...c,
          citaAt:
            c.citaAt instanceof Date && !Number.isNaN(c.citaAt.getTime())
              ? c.citaAt.toISOString()
              : c.citaAt,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (isVisitor && viewMode !== "citas") {
      setViewMode("citas");
    }
  }, [isVisitor, viewMode]);

  const kpiActivos = useMemo(
    () => visitors.filter((v) => v.status === "Dentro").length,
    [visitors]
  );

  const kpiTotalHoy = useMemo(() => {
    const { start, end } = getTodayRange();
    return visitors.filter(
      (v) => v.entryAt && v.entryAt >= start && v.entryAt < end
    ).length;
  }, [visitors]);

  const kpiEmpresas = useMemo(() => {
    const { start, end } = getTodayRange();
    const empresasDeHoy = visitors
      .filter((v) => v.entryAt && v.entryAt >= start && v.entryAt < end)
      .map((v) => v.company);
    return new Set(empresasDeHoy).size;
  }, [visitors]);

  const normalizedSearch = search.toLowerCase().trim();
  const hasSearch = normalizedSearch.length > 0;
  const hasMinSearch = normalizedSearch.length >= 2;

  const filteredVisitors = useMemo(() => {
    const base = isVisitor
      ? visitors.filter((v) => visitaBelongsToVisitor(v, principal))
      : visitors;

    return base.filter((v) => {
      const full = `${v.name} ${v.document} ${v.company} ${v.vehiclePlate}`.toLowerCase();

      const matchesSearch =
        !hasSearch || !hasMinSearch ? true : full.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "todos"
          ? true
          : String(v.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [
    visitors,
    normalizedSearch,
    hasSearch,
    hasMinSearch,
    statusFilter,
    isVisitor,
    principal,
  ]);

  const sortedCitas = useMemo(() => {
    const list = [...onlineCitas];
    list.sort((a, b) => {
      const da = a.citaAt instanceof Date ? a.citaAt.getTime() : 0;
      const db = b.citaAt instanceof Date ? b.citaAt.getTime() : 0;
      return da - db;
    });
    return list;
  }, [onlineCitas]);

  const filteredCitas = useMemo(() => {
    const base = isVisitor
      ? sortedCitas.filter((c) => citaBelongsToVisitor(c, principal))
      : sortedCitas;

    return base.filter((c) => {
      const full = `${c.nombre || c.visitante || ""} ${
        c.documento || ""
      } ${c.empresa || ""} ${c.empleado || ""} ${c.motivo || ""} ${
        c.telefono || ""
      }`
        .toString()
        .toLowerCase();

      const matchesSearch =
        !hasSearch || !hasMinSearch ? true : full.includes(normalizedSearch);

      return matchesSearch;
    });
  }, [
    sortedCitas,
    normalizedSearch,
    hasSearch,
    hasMinSearch,
    isVisitor,
    principal,
  ]);

  async function handleAddVisitor(formData) {
    if (isVisitor) return;

    const isEditing = !!editingVisitor;

    const vehicleBrand = formData.vehicle?.brand || "";
    const vehicleModel = formData.vehicle?.model || "";
    const vehiclePlate = formData.vehicle?.plate || "";

    const vehicleSummary =
      vehicleBrand || vehicleModel || vehiclePlate
        ? `${vehicleBrand || "N/D"}${
            vehicleModel ? " " + vehicleModel : ""
          }${vehiclePlate ? ` (${vehiclePlate})` : ""}`
        : "—";

    if (isEditing && editingVisitor?.id) {
      const id = editingVisitor.id;

      setVisitors((prev) => {
        const next = prev.map((row) =>
          row.id === id
            ? {
                ...row,
                name: formData.name?.trim(),
                document: formData.document?.trim(),
                company: formData.company?.trim() || "—",
                employee: formData.employee?.trim() || "—",
                phone: formData.phone?.trim() || "",
                email: formData.email?.trim() || "",
                reason: formData.reason?.trim() || "",
                kind: formData.visitType || row.kind || "Presencial",
                vehicleBrand,
                vehicleModel,
                vehiclePlate,
                vehicleSummary,
              }
            : row
        );
        saveToStorage(next);
        return next;
      });

      setEditingVisitor(null);
      setShowModal(false);
      return;
    }

    const entryDate = new Date();

    const fmtEntry = `${entryDate.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
    })}, ${entryDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    let backendId = null;
    try {
      const payload = {
        nombre: formData.name?.trim(),
        documento: formData.document?.trim(),
        empresa: formData.company?.trim() || null,
        empleado: formData.employee?.trim() || null,
        motivo: formData.reason?.trim() || null,
        telefono: formData.phone?.trim() || null,
        correo: formData.email?.trim() || null,
        tipo: "Ingreso",
        llegoEnVehiculo: !!(vehicleBrand || vehicleModel || vehiclePlate),
        vehiculo:
          vehicleBrand || vehicleModel || vehiclePlate
            ? {
                marca: vehicleBrand || "",
                modelo: vehicleModel || "",
                placa: vehiclePlate || "",
              }
            : null,
      };

      const res = await fetch(VISITAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data) {
        backendId =
          data?.item?._id || data?.item?.id || data?._id || data?.id || null;
      } else {
        console.warn("[visitas] fallo al crear en backend:", data);
      }
    } catch (err) {
      console.warn("[visitas] error de red al crear en backend:", err);
    }

    const tempId = backendId || `local-${Date.now()}`;

    const newRow = {
      id: tempId,
      _id: tempId,
      kind: formData.visitType || "Presencial",
      name: formData.name?.trim(),
      document: formData.document?.trim(),
      company: formData.company?.trim() || "—",
      employee: formData.employee?.trim() || "—",
      phone: formData.phone?.trim() || "",
      email: formData.email?.trim() || "",
      reason: formData.reason?.trim() || "",
      entry: fmtEntry,
      exit: "-",
      status: "Dentro",
      entryAt: entryDate,
      exitAt: null,
      vehicleBrand,
      vehicleModel,
      vehiclePlate,
      vehicleSummary,
    };

    setVisitors((prev) => {
      const next = [newRow, ...prev];
      saveToStorage(next);
      return next;
    });

    setShowModal(false);
  }

  async function handleExit(id) {
    if (isVisitor) return;
    if (!id) return;

    setSavingExit(id);

    try {
      const res = await fetch(
        `${ROOT}/visitas/${encodeURIComponent(id)}/cerrar`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn("[visitas] fallo cerrando visita en backend:", data);
      }

      const exitDate = new Date();
      const fmtExit = `${exitDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
      })}, ${exitDate.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      setVisitors((prev) => {
        const next = prev.map((row) =>
          row.id === id
            ? { ...row, status: "Finalizada", exit: fmtExit, exitAt: exitDate }
            : row
        );
        saveToStorage(next);
        return next;
      });
    } catch (err) {
      console.warn("[visitas] error de red al cerrar visita:", err);
    } finally {
      setSavingExit(null);
    }
  }

  function handleEditVisitor(visitor) {
    if (isVisitor) return;
    setEditingVisitor(visitor);
    setShowModal(true);
  }

  async function patchLocalAndRemoteCita(citaId, patch) {
    setOnlineCitas((prev) => {
      const next = prev.map((c) =>
        c._id === citaId
          ? {
              ...c,
              ...patch,
              estado: patch.estado ? normalizeCitaEstado(patch.estado) : c.estado,
            }
          : c
      );

      saveCitasToStorage(
        next.map((c) => ({
          ...c,
          citaAt:
            c.citaAt instanceof Date && !Number.isNaN(c.citaAt.getTime())
              ? c.citaAt.toISOString()
              : c.citaAt,
        }))
      );

      return next;
    });
  }

  async function updateCitaStatus(citaId, nuevoEstado) {
    if (isVisitor) return;
    if (!citaId) return;

    setSavingCitaAction(`${citaId}:${nuevoEstado}`);

    const normalized = normalizeCitaEstado(nuevoEstado);
    await patchLocalAndRemoteCita(citaId, { estado: normalized });

    try {
      const url = `${CITAS_API_URL}/${encodeURIComponent(citaId)}/estado`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn(
          "[citas] fallo al actualizar estado en backend:",
          res.status,
          data
        );
      } else if (data?.item) {
        await patchLocalAndRemoteCita(citaId, normalizeCitaFromServer(data.item));
      }
    } catch (err) {
      console.warn("[citas] error de red al actualizar estado:", err);
    } finally {
      setSavingCitaAction(null);
    }
  }

  async function handleRegistrarIngreso(cita) {
    if (isVisitor) return;
    if (!cita?._id) return;

    const actionKey = `${cita._id}:checkin`;
    setSavingCitaAction(actionKey);

    await patchLocalAndRemoteCita(cita._id, { estado: "Dentro" });

    try {
      const url = `${CITAS_API_URL}/${encodeURIComponent(cita._id)}/checkin`;

      const res = await fetch(url, {
        method: "PATCH",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn("[citas] fallo al registrar check-in:", res.status, data);
      } else if (data?.item) {
        await patchLocalAndRemoteCita(cita._id, normalizeCitaFromServer(data.item));
      }
    } catch (err) {
      console.warn("[citas] error de red al registrar ingreso:", err);
    } finally {
      setSavingCitaAction(null);
    }
  }

  function buildExportRows(list) {
    return list.map((v) => ({
      Visitante: v.name || "",
      DNI: v.document || "",
      Empresa: v.company || "",
      Empleado: v.employee || "",
      Tipo: v.kind || "",
      VehiculoMarca: v.vehicleBrand || "",
      VehiculoModelo: v.vehicleModel || "",
      VehiculoPlaca: v.vehiclePlate || "",
      Entrada: v.entry || "",
      Salida: v.exit || "",
      Estado: v.status || "",
    }));
  }

  async function exportExcel(list) {
    const rows = buildExportRows(list);
    if (rows.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Visitas");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `visitas-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Error generando XLSX:", err);
    }
  }

  function exportPDF(list) {
    const rows = buildExportRows(list);
    if (rows.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      doc.setFontSize(14);
      doc.text("Reporte de Visitantes SENAF", 40, 40);

      const headers = Object.keys(rows[0]);
      const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

      autoTable(doc, {
        startY: 60,
        head: [headers],
        body,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
        theme: "grid",
        margin: { left: 20, right: 20 },
      });

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      doc.save(`visitas-${ts}.pdf`);
    } catch (err) {
      console.error("Error generando PDF con jsPDF:", err);
      alert(
        "No se pudo generar PDF automáticamente. Revisa las dependencias (jspdf, jspdf-autotable)."
      );
    }
  }

  function buildExportCitasRows(list) {
    return list.map((c) => {
      const tipoLegible =
        c.tipoCita === "profesional"
          ? "Profesional"
          : c.tipoCita === "personal"
          ? "Personal"
          : "";

      let fecha = "";
      let hora = "";
      if (c.citaAt instanceof Date && !Number.isNaN(c.citaAt.getTime())) {
        fecha = c.citaAt.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        hora = c.citaAt.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        fecha = c.fecha || "";
        hora = c.hora || "";
      }

      return {
        Visitante: c.nombre || c.visitante || "",
        DNI: c.documento || "",
        Empresa: c.empresa || "",
        Empleado: c.empleado || "",
        Motivo: c.motivo || "",
        Telefono: c.telefono || "",
        TipoCita: tipoLegible,
        Fecha: fecha,
        Hora: hora,
        Estado: prettyCitaEstado(c.estado),
      };
    });
  }

  async function exportCitasExcel(list) {
    const rows = buildExportCitasRows(list);
    if (rows.length === 0) {
      alert("No hay citas para exportar.");
      return;
    }
    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Citas");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `citas-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Error generando XLSX de citas:", err);
    }
  }

  function exportCitasPDF(list) {
    const rows = buildExportCitasRows(list);
    if (rows.length === 0) {
      alert("No hay citas para exportar.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      doc.setFontSize(14);
      doc.text("Reporte de Citas (pre-registro)", 40, 40);

      const headers = Object.keys(rows[0]);
      const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

      autoTable(doc, {
        startY: 60,
        head: [headers],
        body,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
        theme: "grid",
        margin: { left: 20, right: 20 },
      });

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      doc.save(`citas-${ts}.pdf`);
    } catch (err) {
      console.error("Error generando PDF de citas:", err);
      alert(
        "No se pudo generar el PDF de citas. Revisa las dependencias (jspdf, jspdf-autotable)."
      );
    }
  }

  const qrModalValue = useMemo(() => getRenderableQrValue(qrCita), [qrCita]);

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6">
      <div className="mesh mesh--ribbon pointer-events-none" aria-hidden />
      <div className="mesh mesh--br pointer-events-none" aria-hidden />
      <div className="mesh mesh--lb pointer-events-none" aria-hidden />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col">
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: "var(--text)" }}
          >
            {isVisitor ? "Mis Citas" : "Gestión de Visitantes"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {isVisitor
              ? "Consulta únicamente tus citas registradas"
              : "Registra y controla el acceso de visitantes"}
          </p>
        </div>

        {!isVisitor && (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                setEditingVisitor(null);
                setShowModal(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition relative z-10"
              style={sxPrimaryBtn({ borderRadius: "9999px" })}
            >
              <span className="font-semibold">+ Registrar Visitante</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/visitas/agenda")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition relative z-10"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <span className="font-semibold">Agenda de Citas</span> →
            </button>

            <button
              type="button"
              onClick={() => navigate("/visitas/scan-qr")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition relative z-10"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <span className="font-semibold">Escanear QR</span> 📷
            </button>
          </div>
        )}
      </div>

      {!isVisitor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            title="Visitantes Activos"
            value={loading ? "…" : kpiActivos}
            icon="👤"
            tone="success"
          />
          <KpiCard
            title="Total Hoy"
            value={loading ? "…" : kpiTotalHoy}
            icon="⏰"
            tone="info"
          />
          <KpiCard
            title="Empresas Visitantes"
            value={loading ? "…" : kpiEmpresas}
            icon="🏢"
            tone="purple"
          />
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {!isVisitor && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ver:
            </span>
            <div
              className="inline-flex items-center rounded-full p-1"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <button
                type="button"
                onClick={() => setViewMode("citas")}
                className="px-3 py-1 text-xs font-semibold rounded-full transition"
                style={
                  viewMode === "citas"
                    ? {
                        background: "#06b6d4",
                        color: "#082f49",
                      }
                    : {
                        color: "var(--text-muted)",
                      }
                }
              >
                Citas
              </button>
              <button
                type="button"
                onClick={() => setViewMode("visitas")}
                className="px-3 py-1 text-xs font-semibold rounded-full transition"
                style={
                  viewMode === "visitas"
                    ? {
                        background: "#06b6d4",
                        color: "#082f49",
                      }
                    : {
                        color: "var(--text-muted)",
                      }
                }
              >
                Visitas
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse md:flex-row md:items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <input
              className="w-full md:w-[300px] rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              placeholder={
                isVisitor
                  ? "Buscar por nombre, DNI, empresa o motivo…"
                  : "Buscar por nombre, DNI, empresa o placa…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!isVisitor && viewMode === "visitas" && (
            <div>
              <select
                className="w-full md:w-[160px] rounded-[14px] px-3 py-2 text-sm outline-none transition"
                style={sxInput()}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                <option value="Dentro">Dentro</option>
                <option value="Finalizada">Finalizada</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {viewMode === "citas" && (
        <section className="p-4 md:p-5 text-sm rounded-[24px]" style={sxCard()}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <div
                className="font-semibold text-base"
                style={{ color: "var(--text)" }}
              >
                {isVisitor
                  ? "Mis citas registradas"
                  : "Solicitudes en línea (pre-registro)"}
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isVisitor
                  ? "Aquí solo ves las citas asociadas a tu correo o documento."
                  : "Citas agendadas por los visitantes para revisión del guardia"}
              </p>
            </div>

            {!isVisitor && (
              <button
                type="button"
                onClick={() => navigate("/visitas/agenda")}
                className="text-xs self-start md:self-auto underline-offset-4 hover:underline relative z-10"
                style={{ color: "#60a5fa" }}
              >
                Ver agenda completa →
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead
                className="text-xs uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                <tr
                  className="[&>th]:py-2 [&>th]:pr-4"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <th>Visitante</th>
                  <th>DNI</th>
                  <th>Empresa</th>
                  <th>Empleado</th>
                  <th>Motivo</th>
                  <th>Teléfono</th>
                  <th>Tipo de cita</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody style={{ color: "var(--text)" }}>
                {filteredCitas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-6 text-center text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {isVisitor
                        ? "No tienes citas registradas."
                        : "Sin resultados"}
                    </td>
                  </tr>
                ) : (
                  filteredCitas.map((cita) => {
                    const tipoLegible =
                      cita.tipoCita === "profesional"
                        ? "Profesional"
                        : cita.tipoCita === "personal"
                        ? "Personal"
                        : "—";

                    const estadoNormalizado = normalizeCitaEstado(cita.estado);
                    const qrValue = getRenderableQrValue(cita);
                    const canShowQr = !!qrValue || !!cita.qrDataUrl;

                    const canRegistrarIngreso =
                      !isVisitor &&
                      ["Autorizada", "En revisión", "Programada"].includes(
                        estadoNormalizado
                      );

                    return (
                      <tr
                        key={cita._id}
                        className="text-sm [&>td]:py-3 [&>td]:pr-4"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td className="font-medium" style={{ color: "var(--text)" }}>
                          {cita.nombre || cita.visitante}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {cita.documento || "-"}
                        </td>
                        <td>{cita.empresa || "—"}</td>
                        <td>{cita.empleado || "—"}</td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {cita.motivo || "—"}
                        </td>
                        <td>{cita.telefono || "—"}</td>
                        <td>{tipoLegible}</td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {cita.citaAt instanceof Date &&
                          !Number.isNaN(cita.citaAt.getTime())
                            ? cita.citaAt.toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : cita.fecha || "—"}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {cita.citaAt instanceof Date &&
                          !Number.isNaN(cita.citaAt.getTime())
                            ? cita.citaAt.toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : cita.hora || "—"}
                        </td>
                        <td>
                          <CitaEstadoPill estado={estadoNormalizado} />
                        </td>
                        <td className="text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
                            {canShowQr && (
                              <button
                                type="button"
                                onClick={() => setQrCita(cita)}
                                className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                style={sxGhostBtn()}
                              >
                                Ver QR
                              </button>
                            )}

                            {!isVisitor && (
                              <>
                                <button
                                  type="button"
                                  disabled={
                                    savingCitaAction === `${cita._id}:En revisión` ||
                                    estadoNormalizado === "Dentro" ||
                                    estadoNormalizado === "Finalizada"
                                  }
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "En revisión")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                  style={sxGhostBtn()}
                                >
                                  En revisión
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    savingCitaAction === `${cita._id}:Autorizada` ||
                                    estadoNormalizado === "Dentro" ||
                                    estadoNormalizado === "Finalizada"
                                  }
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "Autorizada")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                  style={sxSuccessBtn()}
                                >
                                  Autorizar
                                </button>

                                {canRegistrarIngreso && (
                                  <button
                                    type="button"
                                    disabled={savingCitaAction === `${cita._id}:checkin`}
                                    onClick={() => handleRegistrarIngreso(cita)}
                                    className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                    style={sxPrimaryBtn()}
                                  >
                                    Registrar ingreso
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={
                                    savingCitaAction === `${cita._id}:Denegada` ||
                                    estadoNormalizado === "Dentro" ||
                                    estadoNormalizado === "Finalizada"
                                  }
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "Denegada")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                  style={sxDangerBtn()}
                                >
                                  Denegar
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    savingCitaAction === `${cita._id}:Cancelada` ||
                                    estadoNormalizado === "Dentro" ||
                                    estadoNormalizado === "Finalizada"
                                  }
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "Cancelada")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                  style={sxGhostBtn()}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isVisitor && (
            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => exportCitasExcel(filteredCitas)}
                className="px-3 py-2 text-sm rounded-lg transition"
                style={sxGhostBtn()}
                title="Exportar citas (xlsx)"
              >
                Exportar Excel
              </button>

              <button
                type="button"
                onClick={() => exportCitasPDF(filteredCitas)}
                className="px-3 py-2 text-sm rounded-lg transition"
                style={sxGhostBtn()}
                title="Exportar citas (PDF)"
              >
                Exportar PDF
              </button>
            </div>
          )}
        </section>
      )}

      {!isVisitor && viewMode === "visitas" && (
        <section
          className="relative z-[2] p-4 md:p-5 overflow-x-auto text-sm rounded-[24px]"
          style={sxCard()}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div
              className="font-semibold text-base"
              style={{ color: "var(--text)" }}
            >
              Lista de Visitantes
            </div>
          </div>

          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead
              className="text-xs uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              <tr
                className="[&>th]:py-2 [&>th]:pr-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <th>Visitante</th>
                <th>DNI</th>
                <th>Empresa</th>
                <th>Empleado</th>
                <th>Teléfono</th>
                <th>Tipo</th>
                <th>Vehículo</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody style={{ color: "var(--text)" }}>
              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-6 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cargando…
                  </td>
                </tr>
              ) : filteredVisitors.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-6 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Sin resultados
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => (
                  <tr
                    key={v.id}
                    className="text-sm [&>td]:py-3 [&>td]:pr-4"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="font-medium">{v.name}</td>
                    <td style={{ color: "var(--text-muted)" }}>{v.document}</td>
                    <td>{v.company}</td>
                    <td>{v.employee}</td>
                    <td>{v.phone || "—"}</td>
                    <td>{v.kind || "Presencial"}</td>
                    <td>{v.vehicleSummary}</td>
                    <td>{v.entry}</td>
                    <td style={{ color: "var(--text-muted)" }}>{v.exit}</td>
                    <td>
                      {v.status === "Dentro" ? (
                        <span
                          className="px-2 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background:
                              "color-mix(in srgb, #22c55e 12%, transparent)",
                            color: "#86efac",
                            border:
                              "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
                          }}
                        >
                          Dentro
                        </span>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background:
                              "color-mix(in srgb, #64748b 16%, transparent)",
                            color: "#cbd5e1",
                            border:
                              "1px solid color-mix(in srgb, #64748b 36%, transparent)",
                          }}
                        >
                          Finalizada
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleEditVisitor(v)}
                          className="px-2 py-1 rounded-md text-xs font-semibold transition"
                          style={sxPrimaryBtn()}
                        >
                          Editar
                        </button>
                        {v.status === "Dentro" ? (
                          <button
                            type="button"
                            disabled={savingExit === v.id}
                            onClick={() => handleExit(v.id)}
                            className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            style={sxDangerBtn()}
                          >
                            {savingExit === v.id ? "…" : "⏏ Salida"}
                          </button>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            (cerrada)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() => exportExcel(filteredVisitors)}
              className="px-3 py-2 text-sm rounded-lg transition"
              style={sxGhostBtn()}
              title="Exportar lista (xlsx)"
            >
              Exportar Excel
            </button>

            <button
              type="button"
              onClick={() => exportPDF(filteredVisitors)}
              className="px-3 py-2 text-sm rounded-lg transition"
              style={sxGhostBtn()}
              title="Exportar PDF"
            >
              Exportar PDF
            </button>
          </div>
        </section>
      )}

      {showModal && !isVisitor && (
        <NewVisitorModal
          onClose={() => {
            setShowModal(false);
            setEditingVisitor(null);
          }}
          onSubmit={handleAddVisitor}
          knownVisitors={visitors}
          editingVisitor={editingVisitor}
        />
      )}

      {qrCita && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "rgba(2, 6, 23, 0.62)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQrCita(null);
          }}
        >
          <div
            className="p-4 md:p-6 w-[95%] max-w-[420px] rounded-[24px]"
            style={sxCard()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Invitación / QR de cita
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Muestre este código en la entrada para su validación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrCita(null)}
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-[18px] p-4"
                style={sxCardSoft({ background: "#ffffff" })}
              >
                {qrModalValue ? (
                  <QRCodeSVG value={qrModalValue} size={200} includeMargin />
                ) : qrCita.qrDataUrl ? (
                  <img
                    src={qrCita.qrDataUrl}
                    alt="QR de cita"
                    className="w-[200px] h-[200px] object-contain"
                  />
                ) : (
                  <div
                    className="w-[200px] h-[200px] flex items-center justify-center text-center text-xs rounded-[12px]"
                    style={{
                      color: "#334155",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    No hay QR disponible
                  </div>
                )}
              </div>

              <div
                className="text-xs text-center"
                style={{ color: "var(--text)" }}
              >
                <div className="font-semibold">
                  {qrCita.nombre || qrCita.visitante}
                </div>
                <div>{qrCita.documento || "Documento no especificado"}</div>
                <div>
                  {qrCita.citaAt instanceof Date &&
                  !Number.isNaN(qrCita.citaAt.getTime())
                    ? qrCita.citaAt.toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : qrCita.fecha || "—"}{" "}
                  {" · "}
                  {qrCita.citaAt instanceof Date &&
                  !Number.isNaN(qrCita.citaAt.getTime())
                    ? qrCita.citaAt.toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : qrCita.hora || "—"}
                </div>
                <div className="mt-1">
                  Estado: <CitaEstadoPill estado={qrCita.estado} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}