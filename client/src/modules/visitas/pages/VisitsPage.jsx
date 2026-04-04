import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import NewVisitorModal from "../components/NewVisitorModal.jsx";
import KpiCard from "../components/KpiCard.jsx";
import CitasSection from "../components/CitasSection.jsx";
import VisitorsSection from "../components/VisitorsSection.jsx";
import QrPreviewModal from "../components/QrPreviewModal.jsx";
import PendingFeedbackSection from "../components/PendingFeedbackSection.jsx";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

import {
  ROOT,
  VISITAS_API_URL,
  CITAS_API_URL,
  resolveAuthPrincipal,
  citaBelongsToVisitor,
  visitaBelongsToVisitor,
  normalizeCompanionItem,
  formatCompanionsSummary,
  getTodayRange,
  normalizeCitaEstado,
  loadFromStorage,
  loadCitasFromStorage,
  saveToStorage,
  saveCitasToStorage,
  normalizeVisitFromServer,
  normalizeCitaFromServer,
  mergeVisitLists,
  mergeCitaLists,
  exportExcel,
  exportPDF,
  exportCitasExcel,
  exportCitasPDF,
} from "../utils/helpers.js";

import { sxGhostBtn, sxPrimaryBtn, sxInput } from "../styles/styles.js";

function getAuthToken(auth) {
  return (
    auth?.token ||
    auth?.accessToken ||
    auth?.user?.token ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    ""
  );
}

function extractArrayFromApiResponse(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of preferredKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.results)) return payload.results;

  return [];
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

      const token = getAuthToken(auth);

      try {
        const visitasRes = await fetch(VISITAS_API_URL, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        const visitasData = await visitasRes.json().catch(() => ({}));

        if (!visitasRes.ok) {
          console.warn(
            "[visitas] backend respondió con error:",
            visitasRes.status,
            visitasData
          );
        }

        const rawVisits = extractArrayFromApiResponse(visitasData, [
          "items",
          "visitas",
          "visitors",
        ]);

        serverVisits = rawVisits.map(normalizeVisitFromServer);
      } catch (err) {
        console.warn("[visitas] no se pudo leer backend:", err);
      }

      try {
        const citasRes = await fetch(CITAS_API_URL, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        const citasData = await citasRes.json().catch(() => ({}));

        if (!citasRes.ok) {
          console.warn(
            "[citas] backend respondió con error:",
            citasRes.status,
            citasData
          );
        }

        const rawCitas = extractArrayFromApiResponse(citasData, [
          "items",
          "citas",
          "appointments",
        ]);

        serverCitas = rawCitas.map((c, idx) => normalizeCitaFromServer(c, idx));

        console.log("[VisitsPage] CITAS_API_URL:", CITAS_API_URL);
        console.log("[VisitsPage] citasData:", citasData);
        console.log("[VisitsPage] serverCitas normalizadas:", serverCitas);
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
  }, [auth]);

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
      const full =
        `${v.name} ${v.document} ${v.company} ${v.vehiclePlate} ${
          v.companionsSummary || ""
        }`.toLowerCase();

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
    const acompanantes = Array.isArray(formData.acompanantes)
      ? formData.acompanantes.map(normalizeCompanionItem)
      : [];
    const companionsSummary = formatCompanionsSummary(acompanantes);

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
                acompanado: !!formData.acompanado,
                acompanantes,
                companionsSummary,
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
      const token = getAuthToken(auth);

      const payload = {
        nombre: formData.name?.trim(),
        documento: formData.document?.trim(),
        empresa: formData.company?.trim() || null,
        empleado: formData.employee?.trim() || null,
        motivo: formData.reason?.trim() || null,
        telefono: formData.phone?.trim() || null,
        correo: formData.email?.trim() || null,
        tipo: "Ingreso",
        acompanado: !!formData.acompanado,
        acompanantes:
          acompanantes.length > 0
            ? acompanantes.map((item) => ({
                nombre: item.name,
                documento: item.document,
              }))
            : [],
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
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
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
      acompanado: !!formData.acompanado,
      acompanantes,
      companionsSummary,
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
      const token = getAuthToken(auth);

      const res = await fetch(
        `${ROOT}/visitas/${encodeURIComponent(id)}/cerrar`,
        {
          method: "PATCH",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        }
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

  function handleEditCita(cita) {
    if (isVisitor) return;
    if (!cita?._id) return;

    navigate("/visitas/agenda", {
      state: {
        editingCita: cita,
        fromGestionVisitantes: true,
      },
    });
  }

  async function patchLocalAndRemoteCita(citaId, patch) {
    setOnlineCitas((prev) => {
      const next = prev.map((c) =>
        c._id === citaId
          ? {
              ...c,
              ...patch,
              estado: patch.estado
                ? normalizeCitaEstado(patch.estado)
                : c.estado,
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
      const token = getAuthToken(auth);
      const url = `${CITAS_API_URL}/${encodeURIComponent(citaId)}/estado`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
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
        await patchLocalAndRemoteCita(
          citaId,
          normalizeCitaFromServer(data.item)
        );
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
      const token = getAuthToken(auth);
      const url = `${CITAS_API_URL}/${encodeURIComponent(cita._id)}/checkin`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn("[citas] fallo al registrar check-in:", res.status, data);
      } else if (data?.item) {
        await patchLocalAndRemoteCita(
          cita._id,
          normalizeCitaFromServer(data.item)
        );
      }
    } catch (err) {
      console.warn("[citas] error de red al registrar ingreso:", err);
    } finally {
      setSavingCitaAction(null);
    }
  }

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

            <button
              type="button"
              onClick={() => navigate("/visitas/admin/feedback")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition relative z-10"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <span className="font-semibold">Satisfacción</span> ⭐
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
                    ? { background: "#06b6d4", color: "#082f49" }
                    : { color: "var(--text-muted)" }
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
                    ? { background: "#06b6d4", color: "#082f49" }
                    : { color: "var(--text-muted)" }
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
                  : "Buscar por nombre, DNI, empresa, placa o acompañante…"
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
        <CitasSection
          isVisitor={isVisitor}
          filteredCitas={filteredCitas}
          savingCitaAction={savingCitaAction}
          setQrCita={setQrCita}
          updateCitaStatus={updateCitaStatus}
          handleRegistrarIngreso={handleRegistrarIngreso}
          exportCitasExcel={exportCitasExcel}
          exportCitasPDF={exportCitasPDF}
          onEditCita={handleEditCita}
        />
      )}

      {isVisitor && viewMode === "citas" && <PendingFeedbackSection />}

      {!isVisitor && viewMode === "visitas" && (
        <VisitorsSection
          loading={loading}
          filteredVisitors={filteredVisitors}
          savingExit={savingExit}
          handleEditVisitor={handleEditVisitor}
          handleExit={handleExit}
          exportExcel={exportExcel}
          exportPDF={exportPDF}
        />
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

      <QrPreviewModal
        qrCita={qrCita}
        isVisitor={isVisitor}
        savingCitaAction={savingCitaAction}
        setQrCita={setQrCita}
        handleRegistrarIngreso={handleRegistrarIngreso}
      />
    </div>
  );
}