import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NewVisitorModal from "../components/NewVisitorModal.jsx";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";

// 🔹 BASE DEL BACKEND
const ROOT = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api"
).replace(/\/$/, "");

// 🔹 ENDPOINTS
const VISITAS_API_URL = `${ROOT}/visitas/v1/visitas`;
const CITAS_API_URL = `${ROOT}/citas`;

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function resolveAuthPrincipal(auth) {
  const raw = auth?.me || auth?.user || null;
  if (!raw || typeof raw !== "object") return null;

  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : Array.isArray(raw.user?.roles)
    ? raw.user.roles
    : [];

  const email =
    normalizeEmail(raw.email) ||
    normalizeEmail(raw.user?.email) ||
    normalizeEmail(raw.profile?.email) ||
    "";

  const roleSet = new Set(roles.map((r) => String(r || "").toLowerCase()));

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
    roles,
    isVisitor: hint || roleSet.has("visita") || roleSet.has("visitor"),
  };
}

function citaBelongsToVisitor(cita, visitorEmail) {
  const email = normalizeEmail(visitorEmail);
  if (!email) return false;

  const candidates = [
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

  return candidates.includes(email);
}

function visitaBelongsToVisitor(visita, visitorEmail) {
  const email = normalizeEmail(visitorEmail);
  if (!email) return false;

  const candidates = [
    visita?.email,
    visita?.correo,
    visita?.visitorEmail,
    visita?.visitanteEmail,
    visita?.createdByEmail,
    visita?.userEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  return candidates.includes(email);
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

// Rango del día actual
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

const STORAGE_KEY = "visitas_demo";
const CITA_STORAGE_KEY = "citas_demo";

// ===================== Helpers Citas =====================

function prettyCitaEstado(value) {
  if (!value) return "solicitada";
  if (value === "en_revision") return "en revisión";
  if (value === "autorizada") return "ingresada";
  return value;
}

function CitaEstadoPill({ estado }) {
  const val = prettyCitaEstado(estado);

  let style = {
    background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    color: "#fde68a",
    border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
  };

  switch (estado) {
    case "autorizada":
      style = {
        background: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
      };
      break;
    case "denegada":
      style = {
        background: "color-mix(in srgb, #ef4444 12%, transparent)",
        color: "#fca5a5",
        border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
      };
      break;
    case "cancelada":
      style = {
        background: "color-mix(in srgb, #64748b 18%, transparent)",
        color: "#cbd5e1",
        border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
      };
      break;
    case "en_revision":
      style = {
        background: "color-mix(in srgb, #3b82f6 12%, transparent)",
        color: "#93c5fd",
        border: "1px solid color-mix(in srgb, #3b82f6 36%, transparent)",
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

function buildQrValueForCita(cita) {
  if (!cita) return "";

  const nombre = cita.nombre || cita.visitante || "Visitante";
  const documento = cita.documento || "No especificado";
  const empresa = cita.empresa || "—";
  const empleado = cita.empleado || "—";
  const motivo = cita.motivo || "—";

  let fecha = "—";
  let hora = "—";

  if (cita.citaAt instanceof Date && !isNaN(cita.citaAt.getTime())) {
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

// ===================== Componente =====================

export default function VisitsPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const principal = useMemo(() => resolveAuthPrincipal(auth), [auth]);
  const isVisitor = !!principal?.isVisitor;
  const currentVisitorEmail = principal?.email || "";

  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingExit, setSavingExit] = useState(null);

  // Citas
  const [onlineCitas, setOnlineCitas] = useState([]);
  const [qrCita, setQrCita] = useState(null);

  // Visitante que se está editando
  const [editingVisitor, setEditingVisitor] = useState(null);

  // Vista actual
  const [viewMode, setViewMode] = useState(isVisitor ? "citas" : "citas");

  // ========= Storage VISITAS =========
  function saveToStorage(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("[visitas] no se pudo guardar en localStorage:", e);
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

  // ========= Storage CITAS =========
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
        return { ...c, _id: baseId, id: baseId, citaAt };
      });
    } catch (e) {
      console.warn("[citas] no se pudo leer de localStorage:", e);
      return [];
    }
  }

  function saveCitasToStorage(next) {
    try {
      localStorage.setItem(CITA_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("[citas] no se pudieron guardar en localStorage:", e);
    }
  }

  // Carga inicial
  useEffect(() => {
    setVisitors(loadFromStorage());
    setOnlineCitas(loadCitasFromStorage());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isVisitor && viewMode !== "citas") {
      setViewMode("citas");
    }
  }, [isVisitor, viewMode]);

  // ========= KPIs =========
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

  // ========= Filtros =========
  const normalizedSearch = search.toLowerCase().trim();
  const hasSearch = normalizedSearch.length > 0;
  const hasMinSearch = normalizedSearch.length >= 2;

  const filteredVisitors = useMemo(() => {
    const base = isVisitor
      ? visitors.filter((v) => visitaBelongsToVisitor(v, currentVisitorEmail))
      : visitors;

    return base.filter((v) => {
      const full = `${v.name} ${v.document} ${v.company} ${v.vehiclePlate}`.toLowerCase();

      const matchesSearch =
        !hasSearch || !hasMinSearch ? true : full.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "todos"
          ? true
          : v.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [
    visitors,
    normalizedSearch,
    hasSearch,
    hasMinSearch,
    statusFilter,
    isVisitor,
    currentVisitorEmail,
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
      ? sortedCitas.filter((c) => citaBelongsToVisitor(c, currentVisitorEmail))
      : sortedCitas;

    return base.filter((c) => {
      const full = `${c.nombre || c.visitante || ""} ${
        c.documento || ""
      } ${c.empresa || ""} ${c.empleado || ""} ${c.motivo || ""}`
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
    currentVisitorEmail,
  ]);

  // ========= Registrar / editar visitante =========
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

      try {
        const payload = {
          nombre: formData.name?.trim(),
          documento: formData.document?.trim(),
          empresa: formData.company?.trim() || null,
          empleado: formData.employee?.trim() || null,
          motivo: formData.reason?.trim() || null,
          telefono: formData.phone?.trim() || null,
          correo: formData.email?.trim() || null,
          kind: formData.visitType || editingVisitor.kind || "Presencial",
          vehicle:
            vehicleBrand || vehicleModel || vehiclePlate
              ? {
                  brand: vehicleBrand || undefined,
                  model: vehicleModel || undefined,
                  plate: vehiclePlate || undefined,
                }
              : null,
        };

        const url = `${VISITAS_API_URL}/${encodeURIComponent(id)}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.warn(
            "[visitas] fallo al actualizar en backend:",
            res.status,
            data
          );
        }
      } catch (err) {
        console.warn("[visitas] error de red al actualizar en backend:", err);
      }

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
        kind: formData.visitType || "Presencial",
        estado: "Dentro",
        entryAt: entryDate.toISOString(),
        vehicle:
          vehicleBrand || vehicleModel || vehiclePlate
            ? {
                brand: vehicleBrand || undefined,
                model: vehicleModel || undefined,
                plate: vehiclePlate || undefined,
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
          data._id ||
          data.id ||
          data?.item?._id ||
          data?.item?.id ||
          data?.visita?._id ||
          data?.visita?.id ||
          null;
      } else {
        console.warn("[visitas] fallo al crear en backend:", data);
      }
    } catch (err) {
      console.warn("[visitas] error de red al crear en backend:", err);
    }

    const newRow = {
      id: backendId || `local-${Date.now()}`,
      kind: formData.visitType || "Presencial",
      name: formData.name?.trim(),
      document: formData.document?.trim(),
      company: formData.company?.trim() || "—",
      employee: formData.employee?.trim() || "—",
      phone: formData.phone?.trim() || "",
      email: formData.email?.trim() || "",
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

  // ========= Marcar salida =========
  async function handleExit(id) {
    if (isVisitor) return;
    if (!id) return;

    setSavingExit(id);
    try {
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
    } finally {
      setSavingExit(null);
    }
  }

  // ========= Editar visitante =========
  function handleEditVisitor(visitor) {
    if (isVisitor) return;
    setEditingVisitor(visitor);
    setShowModal(true);
  }

  // ========= Cambiar estado cita =========
  async function updateCitaStatus(citaId, nuevoEstado) {
    if (isVisitor) return;
    if (!citaId) return;

    setOnlineCitas((prev) => {
      const next = prev.map((c) =>
        c._id === citaId ? { ...c, estado: nuevoEstado } : c
      );
      saveCitasToStorage(next);
      return next;
    });

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
      }
    } catch (err) {
      console.warn("[citas] error de red al actualizar estado:", err);
    }
  }

  // ========= Export VISITAS =========
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
      doc.text("Reporte de Visitantes", 40, 40);

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

  // ========= Export CITAS =========
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
      if (c.citaAt instanceof Date && !isNaN(c.citaAt.getTime())) {
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

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header */}
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
              onClick={() => {
                setEditingVisitor(null);
                setShowModal(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition"
              style={sxPrimaryBtn({ borderRadius: "9999px" })}
            >
              <span className="font-semibold">+ Registrar Visitante</span>
            </button>

            <button
              onClick={() => navigate("/visitas/agenda")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <span className="font-semibold">Agenda de Citas</span> →
            </button>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
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

      {/* CONTROLES DE VISTA + BUSCADOR */}
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

      {/* Citas */}
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
                  ? "Aquí solo ves las citas asociadas a tu correo."
                  : "Citas agendadas por los visitantes para revisión del guardia"}
              </p>
            </div>

            {!isVisitor && (
              <button
                onClick={() => navigate("/visitas/agenda")}
                className="text-xs self-start md:self-auto underline-offset-4 hover:underline"
                style={{ color: "#60a5fa" }}
              >
                Ver agenda completa →
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
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
                          {cita.citaAt
                            ? cita.citaAt.toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : cita.fecha || "—"}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {cita.citaAt
                            ? cita.citaAt.toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : cita.hora || "—"}
                        </td>
                        <td>
                          <CitaEstadoPill estado={cita.estado} />
                        </td>
                        <td className="text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
                            {cita.estado === "autorizada" && (
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
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "en_revision")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                  style={sxGhostBtn()}
                                >
                                  En revisión
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "autorizada")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                  style={sxSuccessBtn()}
                                >
                                  Ingresar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "denegada")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                  style={sxDangerBtn()}
                                >
                                  Denegar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCitaStatus(cita._id, "cancelada")
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-semibold transition"
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
                onClick={() => exportCitasExcel(filteredCitas)}
                className="px-3 py-2 text-sm rounded-lg transition"
                style={sxGhostBtn()}
                title="Exportar citas (xlsx)"
              >
                Exportar Excel
              </button>

              <button
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

      {/* TABLA VISITANTES */}
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
                            background: "color-mix(in srgb, #22c55e 12%, transparent)",
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
                            background: "color-mix(in srgb, #64748b 16%, transparent)",
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
              onClick={() => exportExcel(filteredVisitors)}
              className="px-3 py-2 text-sm rounded-lg transition"
              style={sxGhostBtn()}
              title="Exportar lista (xlsx)"
            >
              Exportar Excel
            </button>

            <button
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

      {/* Modal QR */}
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
                <QRCodeSVG
                  value={buildQrValueForCita(qrCita)}
                  size={200}
                  includeMargin
                />
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
                  {qrCita.citaAt
                    ? qrCita.citaAt.toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : qrCita.fecha}{" "}
                  {" · "}
                  {qrCita.citaAt
                    ? qrCita.citaAt.toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : qrCita.hora}
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