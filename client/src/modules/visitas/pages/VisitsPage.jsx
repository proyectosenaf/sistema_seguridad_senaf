import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NewVisitorModal from "../components/NewVisitorModal.jsx";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react"; // QR dinámico

// 🔹 BASE DEL BACKEND (igual que en otros módulos)
const ROOT = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api"
).replace(/\/$/, "");

// 🔹 ENDPOINT DEL BACKEND PARA VISITAS (CREATE VISITA)
const VISITAS_API_URL = `${ROOT}/visitas/v1/visitas`;
// 🔹 ENDPOINT PARA CITAS (para actualizar estado desde la vista principal)
const CITAS_API_URL = `${ROOT}/citas`;

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

// Helper para mostrar el texto del estado de la cita
function prettyCitaEstado(value) {
  if (!value) return "solicitada";
  if (value === "en_revision") return "en revisión";
  return value;
}

// Helper para la pastilla de estado de cita
function CitaEstadoPill({ estado }) {
  const val = prettyCitaEstado(estado);
  let cls =
    "px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center justify-center";

  switch (estado) {
    case "autorizada":
      cls +=
        " bg-green-200 text-green-800 dark:bg-green-600/20 dark:text-green-300";
      break;
    case "denegada":
      cls += " bg-red-200 text-red-800 dark:bg-red-600/20 dark:text-red-300";
      break;
    case "cancelada":
      cls += " bg-red-300 text-red-900 dark:bg-red-700/30 dark:text-red-200";
      break;
    case "en_revision":
      cls +=
        " bg-blue-200 text-blue-800 dark:bg-blue-600/20 dark:text-blue-300";
      break;
    default: // solicitada
      cls +=
        " bg-yellow-200 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300";
      break;
  }

  return <span className={cls}>{val}</span>;
}

// 🔹 Helper para quitar tildes del texto (para que el lector de QR no las dañe)
function stripDiacritics(str) {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Contenido del QR (texto tipo ficha) a partir de la cita
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

  // 🔹 Devolvemos el texto SIN tildes para evitar caracteres raros al escanear
  return stripDiacritics(text);
}

export default function VisitsPage() {
  const navigate = useNavigate();

  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingExit, setSavingExit] = useState(null);

  // citas de pre-registro
  const [onlineCitas, setOnlineCitas] = useState([]);

  // cita seleccionada para mostrar QR
  const [qrCita, setQrCita] = useState(null);

  const sendEmpleadoAsId = false; // queda por si lo usas después

  // vista actual: "citas" o "visitas"
  const [viewMode, setViewMode] = useState("citas");

  // ------- Helpers de storage (visitas) -------
  function saveToStorage(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      console.log("[visitas] guardado en localStorage:", next);
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
      const restored = arr.map((v) => ({
        ...v,
        entryAt: v.entryAt ? new Date(v.entryAt) : null,
        exitAt: v.exitAt ? new Date(v.exitAt) : null,
        // Si no trae tipo (visitas viejas), asumimos PRESENCIAL
        kind: v.kind || "Presencial",
      }));
      console.log("[visitas] cargado desde localStorage:", restored);
      return restored;
    } catch (e) {
      console.warn("[visitas] no se pudo leer de localStorage:", e);
      return [];
    }
  }

  // ------- Helpers de storage (citas) -------
  function loadCitasFromStorage() {
    try {
      const raw = localStorage.getItem(CITA_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      const restored = arr.map((c, idx) => {
        const baseId = c._id || c.id || `local-cita-${idx}`;
        let citaAt = null;
        if (c.citaAt) {
          citaAt = new Date(c.citaAt);
        } else if (c.fecha && c.hora) {
          // fecha YYYY-MM-DD, hora HH:mm
          citaAt = new Date(`${c.fecha}T${c.hora}:00`);
        }
        return {
          ...c,
          _id: baseId,
          id: baseId,
          citaAt,
        };
      });
      console.log("[citas] cargadas desde localStorage:", restored);
      return restored;
    } catch (e) {
      console.warn("[citas] no se pudo leer de localStorage:", e);
      return [];
    }
  }

  function saveCitasToStorage(next) {
    try {
      localStorage.setItem(CITA_STORAGE_KEY, JSON.stringify(next));
      console.log("[citas] guardadas en localStorage:", next);
    } catch (e) {
      console.warn("[citas] no se pudieron guardar en localStorage:", e);
    }
  }

  // Al montar el módulo, cargar desde localStorage
  useEffect(() => {
    const restored = loadFromStorage();
    setVisitors(restored);
    setOnlineCitas(loadCitasFromStorage());
    setLoading(false);
  }, []);

  // KPI
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

  // 🔍 normalizamos texto de búsqueda UNA sola vez
  const normalizedSearch = search.toLowerCase().trim();
  const hasSearch = normalizedSearch.length > 0;
  const hasMinSearch = normalizedSearch.length >= 2;

  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      const full = `${v.name} ${v.document} ${v.company} ${v.vehiclePlate}`.toLowerCase();

      // Si no hay búsqueda o hay menos de 2 caracteres, no filtramos por texto
      const matchesSearch =
        !hasSearch || !hasMinSearch ? true : full.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "todos"
          ? true
          : v.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [visitors, normalizedSearch, hasSearch, hasMinSearch, statusFilter]);

  // Citas ordenadas por fecha/hora (se usan solo para mostrar)
  const sortedCitas = useMemo(() => {
    const list = [...onlineCitas];
    list.sort((a, b) => {
      const da = a.citaAt instanceof Date ? a.citaAt.getTime() : 0;
      const db = b.citaAt instanceof Date ? b.citaAt.getTime() : 0;
      return da - db;
    });
    return list;
  }, [onlineCitas]);

  // 🔍 Citas filtradas por el mismo buscador (nombre / documento / empresa / empleado / motivo)
  const filteredCitas = useMemo(() => {
    return sortedCitas.filter((c) => {
      const full = `${c.nombre || c.visitante || ""} ${
        c.documento || ""
      } ${c.empresa || ""} ${c.empleado || ""} ${c.motivo || ""}`
        .toString()
        .toLowerCase();

      const matchesSearch =
        !hasSearch || !hasMinSearch ? true : full.includes(normalizedSearch);

      return matchesSearch;
    });
  }, [sortedCitas, normalizedSearch, hasSearch, hasMinSearch]);

  // ------- Registrar visitante (FRONT + BD) -------
  async function handleAddVisitor(formData) {
    const entryDate = new Date();

    const fmtEntry = `${entryDate.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
    })}, ${entryDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const vehicleBrand = formData.vehicle?.brand || "";
    const vehicleModel = formData.vehicle?.model || "";
    const vehiclePlate = formData.vehicle?.plate || "";

    const vehicleSummary =
      vehicleBrand || vehicleModel || vehiclePlate
        ? `${vehicleBrand || "N/D"}${vehicleModel ? " " + vehicleModel : ""}${
            vehiclePlate ? ` (${vehiclePlate})` : ""
          }`
        : "—";

    // 🔹 1) Intentar guardar en la BASE DE DATOS
    let backendId = null;
    try {
      const payload = {
        nombre: formData.name?.trim(),
        documento: formData.document?.trim(),
        empresa: formData.company?.trim() || null,
        empleado: formData.employee?.trim() || null,
        motivo: formData.reason?.trim() || null, // si en NewVisitorModal envías reason
        telefono: formData.phone?.trim() || null,
        correo: formData.email?.trim() || null,
        kind: "Presencial",
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
        // Intentamos detectar el id según como responda tu API
        backendId =
          data._id ||
          data.id ||
          data?.item?._id ||
          data?.item?.id ||
          data?.visita?._id ||
          data?.visita?.id ||
          null;
        console.log("[visitas] creada en backend:", data);
      } else {
        console.warn("[visitas] fallo al crear en backend:", data);
      }
    } catch (err) {
      console.warn("[visitas] error de red al crear en backend:", err);
    }

    // 🔹 2) Siempre guardar en el estado/localStorage (para que tu módulo siga funcionando igual)
    const newRow = {
      id: backendId || `local-${Date.now()}`, // si hay id de BD lo usamos, si no, local-...
      // Tipo de visita: todas las de este módulo son PRESENCIALES
      kind: "Presencial",
      name: formData.name?.trim(),
      document: formData.document?.trim(),
      company: formData.company?.trim() || "—",
      employee: formData.employee?.trim() || "—",
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
      saveToStorage(next); // guardar inmediatamente
      return next;
    });
      setShowModal(false);
  }

  // ------- Marcar salida (solo front, si quieres luego lo conectamos al backend) -------
  async function handleExit(id) {
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
        saveToStorage(next); // guardar cambio de estado
        return next;
      });

      // Si MÁS ADELANTE quieres cerrar también en la BD,
      // aquí podríamos hacer un PATCH/PUT a /api/visitas/:id/salida
    } finally {
      setSavingExit(null);
    }
  }

  // ------- Cambiar estado de una cita (pre-registro) -------
  async function updateCitaStatus(citaId, nuevoEstado) {
    if (!citaId) return;

    // 1) Actualizar en memoria + localStorage (como ya lo hacías)
    setOnlineCitas((prev) => {
      const next = prev.map((c) =>
        c._id === citaId ? { ...c, estado: nuevoEstado } : c
      );
      saveCitasToStorage(next);
      return next;
    });

    // 2) Sincronizar con el backend para que AgendaPage lo vea también
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
      } else {
        console.log("[citas] estado actualizado en backend:", data);
      }
    } catch (err) {
      console.warn("[citas] error de red al actualizar estado:", err);
    }
  }

  // ------- Export helpers -------
  function buildExportRows(list) {
    return list.map((v) => ({
      Visitante: v.name || "",
      Documento: v.document || "",
      Empresa: v.company || "",
      Empleado: v.employee || "",
      // Tipo en exportes
      Tipo: v.kind || "",
      VehiculoMarca: v.vehicleBrand || "",
      VehiculoModelo: v.vehicleModel || "",
      VehiculoPlaca: v.vehiclePlate || "",
      Entrada: v.entry || "",
      Salida: v.exit || "",
      Estado: v.status || "",
    }));
  }

  function exportCSV(list) {
    const rows = buildExportRows(list);
    if (rows.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const cell = String(r[h] ?? "");
            if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          })
          .join(",")
      ),
    ];
    const csv = csvLines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `visitas-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      exportCSV(list);
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

      const title = "Reporte de Visitantes";
      doc.setFontSize(14);
      doc.text(title, 40, 40);

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

  // ------- Render -------
  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-bold text-neutral-100 dark:text-neutral-100">
            Gestión de Visitantes
          </h1>
          <p className="text-sm text-neutral-400">
            Registra y controla el acceso de visitantes
          </p>
        </div>

        <div className="flex flex-row gap-3 items-center">
          {/* Botón principal */}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-cyan-500 text-neutral-900 font-semibold shadow hover:bg-cyan-400 transition"
          >
            <span className="font-semibold">+ Registrar Visitante</span>
          </button>

          {/* Botón secundario */}
          <button
            onClick={() => navigate("/visitas/agenda")}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-sky-400/70 text-sky-100 bg-sky-900/10 hover:bg-sky-700/30 hover:border-sky-300 transition"
          >
            <span className="font-semibold">Agenda de Citas</span> →
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="fx-card p-4 flex flex-col gap-1">
          <div className="text-sm text-neutral-400 flex items-center gap-2">
            👤 Visitantes Activos
          </div>
          <div className="text-2xl font-semibold text-green-400">
            {loading ? "…" : kpiActivos}
          </div>
        </div>

        <div className="fx-card p-4 flex flex-col gap-1">
          <div className="text-sm text-neutral-400 flex items-center gap-2">
            ⏰ Total Hoy
          </div>
          <div className="text-2xl font-semibold text-blue-400">
            {loading ? "…" : kpiTotalHoy}
          </div>
        </div>

        <div className="fx-card p-4 flex flex-col gap-1">
          <div className="text-sm text-neutral-400 flex items-center gap-2">
            🏢 Empresas Visitantes
          </div>
          <div className="text-2xl font-semibold text-purple-400">
            {loading ? "…" : kpiEmpresas}
          </div>
        </div>
      </div>

      {/* CONTROLES DE VISTA + BUSCADOR (compartido para citas y visitas) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Tabs Citas / Visitas */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Ver:</span>
          <div className="inline-flex items-center rounded-full bg-neutral-900/60 p-1 border border-cyan-500/40">
            <button
              type="button"
              onClick={() => setViewMode("citas")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                viewMode === "citas"
                  ? "bg-cyan-500 text-neutral-900 shadow"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              Citas
            </button>
            <button
              type="button"
              onClick={() => setViewMode("visitas")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                viewMode === "visitas"
                  ? "bg-cyan-500 text-neutral-900 shadow"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              Visitas
            </button>
          </div>
        </div>

        {/* Buscador y filtro de estado (el buscador aplica a ambas vistas) */}
        <div className="flex flex-col-reverse md:flex-row md:items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <input
              className="input-fx w-full md:w-[300px]"
              placeholder="Buscar por nombre, documento, empresa o placa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro de estado SOLO afecta a la tabla de visitantes */}
          {viewMode === "visitas" && (
            <div>
              <select
                className="input-fx w-full md:w-[160px]"
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

      {/* BLOQUE: Solicitudes en línea (pre-registro) */}
      {viewMode === "citas" && filteredCitas.length > 0 && (
        <section className="card-rich p-4 md:p-5 text-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-neutral-200 text-base">
                Solicitudes en línea (pre-registro)
              </div>
              <p className="text-xs text-neutral-400">
                Citas agendadas por los visitantes para revisión del guardia
              </p>
            </div>
            <button
              onClick={() => navigate("/visitas/agenda")}
              className="text-xs text-blue-400 hover:underline"
            >
              Ver agenda completa →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700/40">
                <tr className="[&>th]:py-2 [&>th]:pr-4">
                  <th>Visitante</th>
                  <th>Documento</th>
                  <th>Empresa</th>
                  <th>Empleado</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-neutral-200">
                {filteredCitas.map((cita) => (
                  <tr
                    key={cita._id}
                    className="border-b border-neutral-800/40 text-sm [&>td]:py-3 [&>td]:pr-4"
                  >
                    <td className="font-medium text-neutral-100">
                      {cita.nombre || cita.visitante}
                    </td>
                    <td className="text-neutral-300">
                      {cita.documento || "-"}
                    </td>
                    <td className="text-neutral-200">
                      {cita.empresa || "—"}
                    </td>
                    <td className="text-neutral-200">
                      {cita.empleado || "—"}
                    </td>
                    <td className="text-neutral-300">
                      {cita.motivo || "—"}
                    </td>
                    <td className="text-neutral-300">
                      {cita.citaAt
                        ? cita.citaAt.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : cita.fecha || "—"}
                    </td>
                    <td className="text-neutral-300">
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
                        {/* Ver QR SOLO si está autorizada */}
                        {cita.estado === "autorizada" && (
                          <button
                            type="button"
                            onClick={() => setQrCita(cita)}
                            className="px-2 py-1 rounded-md text-xs font-semibold bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
                          >
                            Ver QR
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            updateCitaStatus(cita._id, "en_revision")
                          }
                          className="px-2 py-1 rounded-md text-xs font-semibold bg-neutral-700/60 hover:bg-neutral-600"
                        >
                          En revisión
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateCitaStatus(cita._id, "autorizada")
                          }
                          className="px-2 py-1 rounded-md text-xs font-semibold bg-green-200 text-green-800 hover:bg-green-300 dark:bg-green-600/20 dark:text-green-300 dark:hover:bg-green-600/30"
                        >
                          Autorizar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateCitaStatus(cita._id, "denegada")
                          }
                          className="px-2 py-1 rounded-md text-xs font-semibold bg-red-200 text-red-800 hover:bg-red-300 dark:bg-red-600/20 dark:text-red-300 dark:hover:bg-red-600/30"
                        >
                          Denegar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateCitaStatus(cita._id, "cancelada")
                          }
                          className="px-2 py-1 rounded-md text-xs font-semibold bg-neutral-500/40 text-neutral-50 hover:bg-neutral-500/60"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCitas.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-6 text-center text-neutral-500 text-sm"
                    >
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TABLA VISITANTES */}
      {viewMode === "visitas" && (
        <section className="relative z-[2] visits-shell card-rich p-4 md:p-5 overflow-x-auto text-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="font-semibold text-neutral-200 text-base">
              Lista de Visitantes
            </div>
          </div>

          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700/40">
              <tr className="[&>th]:py-2 [&>th]:pr-4">
                <th>Visitante</th>
                <th>Documento</th>
                <th>Empresa</th>
                <th>Empleado</th>
                <th>Tipo</th>
                <th>Vehículo</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-neutral-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-6 text-center text-neutral-500 text-sm"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : filteredVisitors.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-6 text-center text-neutral-500 text-sm"
                  >
                    Sin resultados
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-neutral-800/40 text-sm [&>td]:py-3 [&>td]:pr-4"
                  >
                    <td className="font-medium text-neutral-100">
                      <div>{v.name}</div>
                    </td>
                    <td className="text-neutral-400">{v.document}</td>
                    <td className="text-neutral-200">{v.company}</td>
                    <td className="text-neutral-200">{v.employee}</td>
                    <td className="text-neutral-200">
                      {v.kind || "Presencial"}
                    </td>
                    <td className="text-neutral-200">{v.vehicleSummary}</td>
                    <td className="text-neutral-200">{v.entry}</td>
                    <td className="text-neutral-400">{v.exit}</td>
                    <td>
                      {v.status === "Dentro" ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-800 dark:bg-green-600/20 dark:text-green-300">
                          Dentro
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-neutral-300 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-300">
                          Finalizada
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {v.status === "Dentro" ? (
                        <button
                          disabled={savingExit === v.id}
                          onClick={() => handleExit(v.id)}
                          className="px-2 py-1 rounded-md text-xs font-semibold bg-red-200 text-red-700 hover:bg-red-300 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-600/20 dark:text-red-300 dark:hover:bg-red-600/30"
                        >
                          {savingExit === v.id ? "…" : "⏏ Salida"}
                        </button>
                      ) : (
                        <span className="text-neutral-500 text-xs">
                          (cerrada)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* FOOTER: Export buttons */}
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => exportExcel(filteredVisitors)}
              className="px-3 py-2 text-sm rounded-lg bg-neutral-700/40 hover:bg-neutral-700/60"
              title="Exportar lista (xlsx)"
            >
              Exportar Excel
            </button>

            <button
              onClick={() => exportPDF(filteredVisitors)}
              className="px-3 py-2 text-sm rounded-lg bg-neutral-700/40 hover:bg-neutral-700/60"
              title="Exportar PDF"
            >
              Exportar PDF
            </button>
          </div>
        </section>
      )}

      {showModal && (
        <NewVisitorModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleAddVisitor}
        />
      )}

      {/* Modal para mostrar el QR de una cita */}
      {qrCita && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQrCita(null);
          }}
        >
          <div
            className="card-rich p-4 md:p-6 w-[95%] max-w-[420px]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-neutral-100">
                  Invitación / QR de cita
                </h3>
                <p className="text-xs text-neutral-400">
                  Muestre este código en la entrada para su validación.
                </p>
              </div>
              <button
                onClick={() => setQrCita(null)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <QRCodeSVG
                value={buildQrValueForCita(qrCita)}
                size={200}
                includeMargin
              />
              <div className="text-xs text-neutral-300 text-center">
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
