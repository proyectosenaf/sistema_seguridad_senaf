// client/src/pages/Accesos.jsx
import { useEffect, useMemo, useState } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api"
).replace(/\/$/, "");

/* =========================
   ENDPOINTS CATÁLOGOS BACKEND
========================= */
const CATALOGS = {
  sexos: `${API_BASE}/catalogos/acceso/sexos`,
  estados: `${API_BASE}/catalogos/acceso/estados`,
  departamentos: `${API_BASE}/catalogos/acceso/departamentos`,
  cargos: `${API_BASE}/catalogos/acceso/cargos`,
  marcasVehiculos: `${API_BASE}/catalogos/vehiculos/marcas`,
  modelosVehiculos: `${API_BASE}/catalogos/vehiculos/modelos`,
};

/* =========================
   UI TOKENS / HELPERS
========================= */
const UI = {
  page: "space-y-6 layer-content",

  title: "text-xl sm:text-3xl font-semibold tracking-tight",
  subtitle: "mt-1 text-xs sm:text-sm",

  card: "rounded-[20px]",
  cardSoft: "rounded-[20px]",
  section: "rounded-[24px] overflow-hidden",
  sectionHeader:
    "px-4 py-3 flex flex-col gap-2 border-b sm:flex-row sm:items-center sm:justify-between",

  input:
    "w-full rounded-[14px] px-3 sm:px-4 py-2 text-sm outline-none transition",
  fieldInput:
    "w-full rounded-[12px] px-3 py-2 text-sm outline-none transition",
  fieldSelect:
    "w-full rounded-[12px] px-3 py-2 text-sm outline-none transition",

  tableWrap: "overflow-x-auto",
  table: "min-w-full text-xs sm:text-sm",
  thead: "text-left",
  tbody: "",
  rowHover: "transition-colors",

  mutedBox: "rounded-[14px] px-3 py-2 text-xs sm:text-sm",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnSuccess:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnDanger:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnInfo:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnGhost: "px-4 py-2 rounded-[12px] text-sm transition",
  btnLink: "text-[11px] sm:text-xs transition-colors",

  modalOverlay:
    "fixed inset-0 z-[60] flex items-center justify-center px-3",
  modalOverlayHigh:
    "fixed inset-0 z-[70] flex items-center justify-center px-3",
  modalOverlayTop:
    "fixed inset-0 z-[75] flex items-center justify-center px-3",

  modalBox: "w-full rounded-[22px]",
  modalHeader:
    "flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4",

  label: "text-xs sm:text-sm",
  helper: "text-[11px] sm:text-xs",
  subtleBar: "px-4 py-2 text-[11px] sm:text-xs font-semibold uppercase",
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

function sxCardSolid(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 90%, transparent)",
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

function sxInfoBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #0891b2, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #0891b2 22%, transparent)",
    ...extra,
  };
}

function sxMutedBox(extra = {}) {
  return {
    background: "color-mix(in srgb, #ef4444 10%, var(--card-solid))",
    color: "#dc2626",
    border: "1px solid color-mix(in srgb, #ef4444 30%, var(--border))",
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

/* =========================
   HELPERS CATÁLOGOS
========================= */
function normalizeCatalogItems(data) {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return String(
        item?.label ??
          item?.name ??
          item?.nombre ??
          item?.value ??
          item?.codigo ??
          ""
      ).trim();
    })
    .filter(Boolean);
}

async function fetchCatalog(url) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || "No se pudo cargar catálogo");
  }
  return normalizeCatalogItems(data);
}

/* =========================
   HELPERS GENERALES
========================= */
function normalizeItems(employeesRaw) {
  const employees = Array.isArray(employeesRaw) ? employeesRaw : [];
  const rows = [];

  for (const e of employees) {
    const empleado = {
      _id: e._id,
      nombreCompleto: e.nombreCompleto || e.nombre || "",
      id_persona:
        e.id_persona || e.idPersona || e.codigoInterno || e.idInterno || "",
      departamento: e.departamento || e.depto || "",
      fotoUrl: e.foto_empleado || e.fotoUrl || e.foto || "",
      activo: typeof e.activo === "boolean" ? e.activo : true,
      dni: e.dni || "",
      sexo: e.sexo || "",
      direccion: e.direccion || "",
      telefono: e.telefono || "",
      cargo: e.cargo || "",
      fechaNacimiento: e.fechaNacimiento || "",
      fechaIngreso: e.fechaIngreso || "",
    };

    const vehs = Array.isArray(e.vehiculos) ? e.vehiculos : [];

    if (vehs.length === 0) {
      rows.push({ _id: `${e._id}-no-veh`, empleado, vehiculo: null });
      continue;
    }

    for (const v of vehs) {
      rows.push({
        _id: `${e._id}-${v._id || v.placa || Math.random().toString(36).slice(2)}`,
        empleado,
        vehiculo: {
          _id: v._id,
          modelo: v.modelo || v.marcaModelo || v.marca || "",
          placa: v.placa || v.noPlaca || "",
          enEmpresa: typeof v.enEmpresa === "boolean" ? v.enEmpresa : false,
        },
      });
    }
  }

  return rows;
}

function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDniInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 8);
  const part3 = digits.slice(8, 13);
  if (digits.length <= 4) return part1;
  if (digits.length <= 8) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
}

function formatTelefonoInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 8);
  if (digits.length <= 4) return part1;
  return `${part1}-${part2}`;
}

function safeVehiculoVisitaKey(v, idx) {
  return v?.id || v?._id || v?.placa || `veh-vis-${idx}`;
}

export default function Accesos() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showNewEmp, setShowNewEmp] = useState(false);
  const [editEmpleado, setEditEmpleado] = useState(null);
  const [showNewVeh, setShowNewVeh] = useState(false);

  const [vehiculosVisitas, setVehiculosVisitas] = useState([]);
  const [loadingVehVis, setLoadingVehVis] = useState(true);
  const [errVehVis, setErrVehVis] = useState("");

  const [showAllAccesos, setShowAllAccesos] = useState(false);
  const [showAllVehVis, setShowAllVehVis] = useState(false);
  const [showAllRegistros, setShowAllRegistros] = useState(false);

  const [catalogos, setCatalogos] = useState({
    sexos: [],
    estados: [],
    departamentos: [],
    cargos: [],
    marcasVehiculos: [],
  });

  const [registros, setRegistros] = useState(() => {
    try {
      const stored = localStorage.getItem("movimientosManual");
      if (stored) {
        const arr = JSON.parse(stored);
        return Array.isArray(arr)
          ? arr.map((r) => {
              if (!r.fechaIso && r.fechaHora) {
                const parts = r.fechaHora.split(" ");
                if (parts[0]) {
                  const [dd, mm, yyyy] = parts[0].split("/");
                  r.fechaIso = `${yyyy}-${mm}-${dd}`;
                }
              }
              return r;
            })
          : [];
      }
    } catch (_) {}
    return [];
  });

  const [showNuevoMov, setShowNuevoMov] = useState(false);

  const [showObsModal, setShowObsModal] = useState(false);
  const [obsTipo, setObsTipo] = useState("");
  const [obsFila, setObsFila] = useState(null);
  const [obsValue, setObsValue] = useState("");

  const [filterEmpleado, setFilterEmpleado] = useState("");
  const [filterDepto, setFilterDepto] = useState("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  async function fetchCatalogos() {
    try {
      const results = await Promise.allSettled([
        fetchCatalog(CATALOGS.sexos),
        fetchCatalog(CATALOGS.estados),
        fetchCatalog(CATALOGS.departamentos),
        fetchCatalog(CATALOGS.cargos),
        fetchCatalog(CATALOGS.marcasVehiculos),
      ]);

      const next = {
        sexos: results[0].status === "fulfilled" ? results[0].value : [],
        estados: results[1].status === "fulfilled" ? results[1].value : [],
        departamentos: results[2].status === "fulfilled" ? results[2].value : [],
        cargos: results[3].status === "fulfilled" ? results[3].value : [],
        marcasVehiculos:
          results[4].status === "fulfilled" ? results[4].value : [],
      };

      if (results[0].status === "rejected") {
        console.warn("[Accesos] catálogo sexos error:", results[0].reason);
      }
      if (results[1].status === "rejected") {
        console.warn("[Accesos] catálogo estados error:", results[1].reason);
      }
      if (results[2].status === "rejected") {
        console.warn(
          "[Accesos] catálogo departamentos error:",
          results[2].reason
        );
      }
      if (results[3].status === "rejected") {
        console.warn("[Accesos] catálogo cargos error:", results[3].reason);
      }
      if (results[4].status === "rejected") {
        console.warn(
          "[Accesos] catálogo marcasVehiculos error:",
          results[4].reason
        );
      }

      console.log("[Accesos] catálogos cargados:", next);
      setCatalogos(next);
    } catch (e) {
      console.warn("[Accesos] error general cargando catálogos:", e);
    }
  }

  async function handleGuardarObs() {
    if (!obsFila) return;

    const fila = obsFila;
    const now = new Date();
    const fechaHora = formatDateTime(now);
    const fechaIso = now.toISOString().slice(0, 10);
    const persona = fila?.empleado?.nombreCompleto || "";
    const placa = fila?.vehiculo?.placa || "";
    const tipoRegistro = obsTipo === "ENTRADA" ? "Entrada" : "Salida";

    const nuevoRegistro = {
      fechaHora,
      fechaFin: "",
      noRegresa: false,
      tipo: tipoRegistro,
      persona,
      personaId: fila?.empleado?._id || "",
      placa,
      observacion: obsValue.trim(),
      departamento: fila?.empleado?.departamento || "",
      fechaIso,
    };

    await agregarRegistro(nuevoRegistro);
    setShowObsModal(false);
    setObsFila(null);
    setObsTipo("");
    setObsValue("");
  }

  function exportarRegistrosCsv(records = registros) {
    const lista = Array.isArray(records) ? records : registros;
    if (!lista.length) {
      alert("No hay registros para exportar.");
      return;
    }

    const entradas = lista.filter(
      (r) => r.tipo === "Entrada" || r.tipo === "Salida"
    );
    const permisos = lista.filter((r) => r.tipo === "Permiso");

    const headerEntradas = [
      "Fecha/Hora",
      "Tipo",
      "Empleado",
      "Placa",
      "Observación",
      "Departamento",
    ];
    const filasEntradas = entradas.map((r) => [
      r.fechaHora || "",
      r.tipo || "",
      r.persona || "",
      r.placa || "",
      r.observacion || "",
      r.departamento || "",
    ]);

    const headerPermisos = [
      "Hora salida",
      "Hora regreso",
      "No regresa",
      "Empleado",
      "Placa",
      "Observación",
      "Departamento",
    ];
    const filasPermisos = permisos.map((r) => [
      r.fechaHora || "",
      r.noRegresa ? "" : r.fechaFin || "",
      r.noRegresa ? "X" : "",
      r.persona || "",
      r.placa || "",
      r.observacion || "",
      r.departamento || "",
    ]);

    const lines = [];
    lines.push(headerEntradas.map((h) => `"${h}"`).join(","));
    filasEntradas.forEach((f) => {
      lines.push(
        f.map((item) => `"${String(item || "").replace(/\"/g, '""')}"`).join(",")
      );
    });

    if (filasEntradas.length && filasPermisos.length) lines.push("");

    if (filasPermisos.length) {
      lines.push(headerPermisos.map((h) => `"${h}"`).join(","));
      filasPermisos.forEach((f) => {
        lines.push(
          f.map((item) => `"${String(item || "").replace(/\"/g, '""')}"`).join(",")
        );
      });
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "historial_movimientos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportarRegistrosPdf(records = registros) {
    const lista = Array.isArray(records) ? records : registros;
    if (!lista.length) {
      alert("No hay registros para exportar.");
      return;
    }

    const entradas = lista.filter(
      (r) => r.tipo === "Entrada" || r.tipo === "Salida"
    );
    const permisos = lista.filter((r) => r.tipo === "Permiso");

    let entradasHtml = "";
    if (entradas.length) {
      const headerEntradasHtml =
        `<tr>` +
        `<th>Fecha/Hora</th>` +
        `<th>Tipo</th>` +
        `<th>Empleado</th>` +
        `<th>Placa</th>` +
        `<th>Observación</th>` +
        `<th>Departamento</th>` +
        `</tr>`;

      const rowsEntradasHtml = entradas
        .map(
          (r) =>
            `<tr>` +
            `<td>${r.fechaHora || ""}</td>` +
            `<td>${r.tipo || ""}</td>` +
            `<td>${r.persona || ""}</td>` +
            `<td>${r.placa || ""}</td>` +
            `<td>${r.observacion || ""}</td>` +
            `<td>${r.departamento || ""}</td>` +
            `</tr>`
        )
        .join("");

      entradasHtml =
        `<h2>Entradas y salidas</h2>` +
        `<table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">${headerEntradasHtml}${rowsEntradasHtml}</table>`;
    }

    let permisosHtml = "";
    if (permisos.length) {
      const headerPermisosHtml =
        `<tr>` +
        `<th>Hora salida</th>` +
        `<th>Hora regreso</th>` +
        `<th>No regresa</th>` +
        `<th>Empleado</th>` +
        `<th>Placa</th>` +
        `<th>Observación</th>` +
        `<th>Departamento</th>` +
        `</tr>`;

      const rowsPermisosHtml = permisos
        .map(
          (r) =>
            `<tr>` +
            `<td>${r.fechaHora || ""}</td>` +
            `<td>${r.noRegresa ? "" : r.fechaFin || ""}</td>` +
            `<td>${r.noRegresa ? "X" : ""}</td>` +
            `<td>${r.persona || ""}</td>` +
            `<td>${r.placa || ""}</td>` +
            `<td>${r.observacion || ""}</td>` +
            `<td>${r.departamento || ""}</td>` +
            `</tr>`
        )
        .join("");

      permisosHtml =
        `<h2>Permisos</h2>` +
        `<table style="width:100%; border-collapse: collapse;">${headerPermisosHtml}${rowsPermisosHtml}</table>`;
    }

    const win = window.open("", "", "width=1000,height=600");
    win.document.write(
      `<html><head><title>Historial de movimientos manuales</title><style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1, h2 { color: #2c3e50; margin-top: 20px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #2c3e50; color: #ecf0f1; padding: 8px; font-size: 12px; }
        td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        tr:nth-child(even) td { background-color: #f9f9f9; }
        tr:nth-child(odd) td { background-color: #ffffff; }
      </style></head><body>`
    );

    win.document.write(`<h1>Historial de movimientos manuales</h1>`);
    if (entradasHtml) win.document.write(entradasHtml);
    if (permisosHtml) win.document.write(permisosHtml);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
  }

  async function agregarRegistro(registro) {
    try {
      await crearRegistroManual(registro);
    } catch (_) {}

    setRegistros((prev) => [registro, ...prev]);

    try {
      const stored = localStorage.getItem("movimientosManual");
      const arr = stored ? JSON.parse(stored) : [];
      arr.unshift(registro);
      localStorage.setItem("movimientosManual", JSON.stringify(arr));
    } catch (_) {}
  }

  async function fetchRegistrosManual() {
    try {
      const res = await fetch(`${API_BASE}/acceso/movimientos-manual`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (
        res.ok &&
        data?.ok !== false &&
        Array.isArray(data?.items) &&
        data.items.length
      ) {
        const convertidos = data.items.map((item) => {
          const fecha = item.fechaHora ? new Date(item.fechaHora) : null;
          const fechaStr = fecha ? formatDateTime(fecha) : "";
          const fechaFin = item.fechaFin ? new Date(item.fechaFin) : null;
          const fechaFinStr = fechaFin ? formatDateTime(fechaFin) : "";
          const iso = fecha ? item.fechaHora.slice(0, 10) : "";

          return {
            fechaHora: fechaStr,
            fechaFin: fechaFinStr,
            noRegresa: !!item.noRegresa,
            tipo: item.tipo || "",
            persona: item.persona || "",
            personaId: item.personaId || "",
            placa: item.placa || "",
            observacion: item.observacion || "",
            departamento: item.departamento || "",
            fechaIso: iso,
          };
        });

        setRegistros(convertidos);

        try {
          localStorage.setItem("movimientosManual", JSON.stringify(convertidos));
        } catch (_) {}

        return;
      }

      try {
        const stored = localStorage.getItem("movimientosManual");
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) setRegistros(arr);
        }
      } catch (_) {}
    } catch (error) {
      console.error("Error al cargar movimientos manuales", error);
      try {
        const stored = localStorage.getItem("movimientosManual");
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) setRegistros(arr);
        }
      } catch (_) {}
    }
  }

  async function crearRegistroManual(registro) {
    let fechaHoraISO = null;
    if (registro.fechaIso && registro.fechaHora) {
      const horaPart = registro.fechaHora.split(" ")[1] || "00:00";
      fechaHoraISO = new Date(
        `${registro.fechaIso}T${horaPart}:00`
      ).toISOString();
    }

    const fechaFinISO = registro.noRegresa
      ? null
      : registro.fechaFin && registro.fechaIso
      ? new Date(
          `${registro.fechaIso}T${
            registro.fechaFin.split(" ")[1] || "00:00"
          }:00`
        ).toISOString()
      : null;

    const body = {
      fechaHora: fechaHoraISO,
      fechaFin: fechaFinISO,
      noRegresa: !!registro.noRegresa,
      tipo: registro.tipo,
      personaId: registro.personaId || null,
      persona: registro.persona,
      placa: registro.placa || null,
      observacion: registro.observacion || null,
      departamento: registro.departamento || null,
    };

    const res = await fetch(`${API_BASE}/acceso/movimientos-manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || "No se pudo crear el movimiento manual");
    }
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const term = q.toLowerCase();
    return rows.filter((r) =>
      [
        r?.empleado?.nombreCompleto,
        r?.empleado?.id_persona,
        r?.empleado?.departamento,
        r?.vehiculo?.modelo,
        r?.vehiculo?.placa,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [rows, q]);

  const visibleAccesos = useMemo(() => {
    if (showAllAccesos) return filtered;
    if (filtered.length <= 5) return filtered;
    return filtered.slice(filtered.length - 5);
  }, [filtered, showAllAccesos]);

  async function fetchItems() {
    try {
      setLoading(true);
      setErr("");

      let res = await fetch(`${API_BASE}/acceso/empleados-vehiculos`, {
        credentials: "include",
      });
      let data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false || !Array.isArray(data?.items)) {
        res = await fetch(`${API_BASE}/acceso/empleados`, {
          credentials: "include",
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "Error de API");
        }
      }

      setRows(normalizeItems(data.items));
    } catch (e) {
      console.error(e);
      setErr(e.message || "Error de red");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVehiculosVisitas() {
    try {
      setLoadingVehVis(true);
      setErrVehVis("");

      const res = await fetch(`${API_BASE}/visitas/vehiculos-en-sitio`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false || !Array.isArray(data?.items)) {
        throw new Error(data?.error || data?.message || "Error de API");
      }

      setVehiculosVisitas(data.items);
    } catch (e) {
      console.error(e);
      setErrVehVis(e.message || "Error al cargar vehículos de visitas");
      setVehiculosVisitas([]);
    } finally {
      setLoadingVehVis(false);
    }
  }

  const visibleVehiculosVisitas = useMemo(() => {
    if (showAllVehVis) return vehiculosVisitas;
    if (vehiculosVisitas.length <= 5) return vehiculosVisitas;
    return vehiculosVisitas.slice(0, 5);
  }, [vehiculosVisitas, showAllVehVis]);

  async function handleToggleEnEmpresa(row, nextValue) {
    if (!row?.vehiculo?._id) return;

    try {
      const res = await fetch(
        `${API_BASE}/acceso/vehiculos/${row.vehiculo._id}/en-empresa`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ enEmpresa: nextValue }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "No se pudo actualizar el estado del vehículo"
        );
      }

      await fetchItems();
    } catch (e) {
      console.error(e);
      alert(e.message || "Error actualizando vehículo");
    }
  }

  async function handleDeleteEmpleado(empleado) {
    if (!empleado?._id) return;

    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar a “${
        empleado.nombreCompleto || "este empleado"
      }”? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/acceso/empleados/${empleado._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo eliminar el empleado");
      }

      await fetchItems();
    } catch (error) {
      alert(error.message || "Error al eliminar el empleado");
    }
  }

  async function registrarMovimientoRapido(tipo, fila) {
    const persona = fila?.empleado?.nombreCompleto || "";
    const confirmMsg =
      tipo === "ENTRADA"
        ? `¿Registrar entrada para ${persona}?`
        : `¿Registrar salida para ${persona}?`;

    const ok = window.confirm(confirmMsg);
    if (!ok) return;

    setObsTipo(tipo);
    setObsFila(fila);
    setObsValue("");
    setShowObsModal(true);
  }

  useEffect(() => {
    fetchItems();
    fetchVehiculosVisitas();
    fetchRegistrosManual();
    fetchCatalogos();
  }, []);

  const empleadosList = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const e = r.empleado;
      if (e && !map.has(e._id)) map.set(e._id, e);
    });
    return Array.from(map.values());
  }, [rows]);

  const deptosDisponibles = useMemo(() => {
    const set = new Set();
    empleadosList.forEach((e) => {
      if (e && e.departamento) set.add(e.departamento);
    });
    const base = Array.from(set).sort();
    const fromCatalog = catalogos.departamentos || [];
    return Array.from(new Set([...base, ...fromCatalog])).sort();
  }, [empleadosList, catalogos.departamentos]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filterEmpleado && r.personaId !== filterEmpleado) return false;
      if (filterDepto && r.departamento !== filterDepto) return false;
      const fecha = r.fechaIso || "";
      if (filterDesde && fecha < filterDesde) return false;
      if (filterHasta && fecha > filterHasta) return false;
      return true;
    });
  }, [registros, filterEmpleado, filterDepto, filterDesde, filterHasta]);

  const registrosEntradas = useMemo(() => {
    return registrosFiltrados.filter(
      (r) => r.tipo === "Entrada" || r.tipo === "Salida"
    );
  }, [registrosFiltrados]);

  const registrosPermisos = useMemo(() => {
    return registrosFiltrados.filter((r) => r.tipo === "Permiso");
  }, [registrosFiltrados]);

  const visibleRegistrosEntradas = useMemo(() => {
    if (showAllRegistros) return registrosEntradas;
    if (registrosEntradas.length <= 5) return registrosEntradas;
    return registrosEntradas.slice(0, 5);
  }, [registrosEntradas, showAllRegistros]);

  const visibleRegistrosPermisos = useMemo(() => {
    if (showAllRegistros) return registrosPermisos;
    if (registrosPermisos.length <= 5) return registrosPermisos;
    return registrosPermisos.slice(0, 5);
  }, [registrosPermisos, showAllRegistros]);

  return (
    <div className={UI.page}>
      <div className="mb-2 sm:mb-4">
        <h1 className={UI.title} style={{ color: "var(--text)" }}>
          Control de Acceso
        </h1>
        <p className={UI.subtitle} style={{ color: "var(--text-muted)" }}>
          Registro de personal y vehículos.
        </p>
      </div>

      <div className="flex flex-col gap-3 mb-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
          <button
            type="button"
            className={`flex-1 sm:flex-none ${UI.btnInfo}`}
            style={sxInfoBtn()}
            onClick={() => setShowNewEmp(true)}
          >
            <span className="text-lg sm:text-xl leading-none">＋</span> Nuevo
            Empleado
          </button>
          <button
            type="button"
            className={`flex-1 sm:flex-none ${UI.btnSuccess}`}
            style={sxSuccessBtn()}
            onClick={() => setShowNewVeh(true)}
          >
            <span className="text-lg sm:text-xl leading-none">＋</span> Nuevo
            Vehículo
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, id persona, depto, placa…"
            className={UI.input}
            style={sxInput()}
          />
          <span
            className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Ctrl/⌘+K
          </span>
        </div>
      </div>

      <div className={UI.cardSoft} style={sxCard()}>
        <div className="flex justify-end px-4 pt-3">
          {filtered.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllAccesos((v) => !v)}
              className={UI.btnLink}
              style={{ color: "var(--accent)" }}
            >
              {showAllAccesos
                ? "Ver solo últimos 5 registros"
                : "Ver todos los registros"}
            </button>
          )}
        </div>

        <div className={UI.tableWrap}>
          <table className={UI.table}>
            <thead className={UI.thead} style={sxSectionBar()}>
              <tr>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Foto</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">
                  ID Persona
                </th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">
                  Depto
                </th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">
                  Vehículo
                </th>
                <th className="px-4 py-3 font-medium">No. Placa</th>
                <th className="px-4 py-3 font-medium">En Empresa</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                  Registro
                </th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className={UI.tbody}>
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cargando…
                  </td>
                </tr>
              )}

              {err && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center"
                    style={{ color: "#dc2626" }}
                  >
                    Error: {err}
                  </td>
                </tr>
              )}

              {!loading && !err && visibleAccesos.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Sin resultados.
                  </td>
                </tr>
              )}

              {!loading &&
                !err &&
                visibleAccesos.map((row) => (
                  <tr
                    key={row._id}
                    className="align-middle"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Avatar
                        url={row?.empleado?.fotoUrl}
                        name={row?.empleado?.nombreCompleto}
                      />
                    </td>

                    <td
                      className="px-4 py-3 font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      <div className="flex flex-col">
                        <span className="truncate max-w-[160px] sm:max-w-none">
                          {row?.empleado?.nombreCompleto || "—"}
                        </span>
                        <span
                          className="md:hidden text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {row?.empleado?.departamento || "Sin depto"} ·{" "}
                          {row?.empleado?.id_persona || "Sin ID"}
                        </span>
                      </div>
                    </td>

                    <td
                      className="px-4 py-3 hidden md:table-cell"
                      style={{ color: "var(--text)" }}
                    >
                      {row?.empleado?.id_persona || "—"}
                    </td>

                    <td
                      className="px-4 py-3 hidden md:table-cell"
                      style={{ color: "var(--text)" }}
                    >
                      {row?.empleado?.departamento || "—"}
                    </td>

                    <td
                      className="px-4 py-3 hidden lg:table-cell"
                      style={{ color: "var(--text)" }}
                    >
                      {row?.vehiculo?.modelo || "—"}
                    </td>

                    <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                      {row?.vehiculo?.placa || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <EnEmpresaSwitch
                        value={!!row?.vehiculo?.enEmpresa}
                        disabled={!row?.vehiculo?._id}
                        onChange={(val) => {
                          setRows((prev) =>
                            prev.map((r) =>
                              r._id === row._id
                                ? {
                                    ...r,
                                    vehiculo: r.vehiculo
                                      ? { ...r.vehiculo, enEmpresa: val }
                                      : r.vehiculo,
                                  }
                                : r
                            )
                          );
                          handleToggleEnEmpresa(row, val);
                        }}
                      />
                    </td>

                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          title="Registrar entrada"
                          className="px-2 py-1 rounded-lg text-[11px] sm:text-xs transition"
                          style={{
                            background:
                              "color-mix(in srgb, #22c55e 12%, transparent)",
                            color: "#16a34a",
                          }}
                          onClick={() =>
                            registrarMovimientoRapido("ENTRADA", row)
                          }
                        >
                          Entrada
                        </button>

                        <button
                          type="button"
                          title="Registrar salida"
                          className="px-2 py-1 rounded-lg text-[11px] sm:text-xs transition"
                          style={{
                            background:
                              "color-mix(in srgb, #ef4444 12%, transparent)",
                            color: "#dc2626",
                          }}
                          onClick={() =>
                            registrarMovimientoRapido("SALIDA", row)
                          }
                        >
                          Salida
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          title="Editar empleado"
                          className="p-1.5 rounded-lg transition"
                          style={{ background: "transparent" }}
                          onClick={() => setEditEmpleado(row.empleado)}
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 64 64"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5"
                          >
                            <rect width="64" height="64" fill="#0A0F24" />
                            <g
                              stroke="#17B4E9"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            >
                              <path d="M18 46 L46 18" />
                              <polyline points="46 18 50 22 22 50 18 46" />
                              <line x1="46" y1="18" x2="50" y2="22" />
                            </g>
                          </svg>
                        </button>

                        <button
                          title="Eliminar empleado"
                          className="p-1.5 rounded-lg transition"
                          style={{ background: "transparent", color: "#dc2626" }}
                          onClick={() => handleDeleteEmpleado(row.empleado)}
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 64 64"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5"
                          >
                            <rect width="64" height="64" fill="#0A0F24" />
                            <g
                              stroke="#E64A6D"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            >
                              <polyline points="20 22 44 22" />
                              <polyline points="24 22 26 16 38 16 40 22" />
                              <rect x="20" y="22" width="24" height="26" rx="4" />
                              <line x1="26" y1="28" x2="26" y2="44" />
                              <line x1="32" y1="28" x2="32" y2="44" />
                              <line x1="38" y1="28" x2="38" y2="44" />
                            </g>
                          </svg>
                        </button>

                        <div className="flex sm:hidden w-full justify-start gap-1 mt-1">
                          <button
                            type="button"
                            title="Registrar entrada"
                            className="flex-1 px-2 py-1 rounded-lg text-[11px] transition"
                            style={{
                              background:
                                "color-mix(in srgb, #22c55e 12%, transparent)",
                              color: "#16a34a",
                            }}
                            onClick={() =>
                              registrarMovimientoRapido("ENTRADA", row)
                            }
                          >
                            Entrada
                          </button>

                          <button
                            type="button"
                            title="Registrar salida"
                            className="flex-1 px-2 py-1 rounded-lg text-[11px] transition"
                            style={{
                              background:
                                "color-mix(in srgb, #ef4444 12%, transparent)",
                              color: "#dc2626",
                            }}
                            onClick={() =>
                              registrarMovimientoRapido("SALIDA", row)
                            }
                          >
                            Salida
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div
          className="px-4 py-3 text-[11px] sm:text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Consejo: “En Empresa” indica si el vehículo del empleado está dentro
          del estacionamiento. Haz clic en la flecha para actualizar su estado.
        </div>
      </div>

      <section className={UI.section} style={sxCard()}>
        <div className={UI.sectionHeader} style={sxSectionBar()}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Vehículos de visitantes en el estacionamiento
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Información tomada del módulo de Visitas (solo visitas con estado
              “Dentro” y que llegaron en vehículo).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {vehiculosVisitas.length} vehículos
            </span>

            {vehiculosVisitas.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllVehVis((v) => !v)}
                className={UI.btnLink}
                style={{ color: "var(--accent)" }}
              >
                {showAllVehVis
                  ? "Ver solo 5 registros"
                  : "Ver todos los registros"}
              </button>
            )}
          </div>
        </div>

        <div className={UI.tableWrap}>
          <table className={UI.table}>
            <thead style={sxSectionBar()}>
              <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide">
                <th className="px-4 py-3">Visitante</th>
                <th className="px-4 py-3 hidden md:table-cell">Documento</th>
                <th className="px-4 py-3 hidden lg:table-cell">Empresa</th>
                <th className="px-4 py-3 hidden sm:table-cell">
                  Empleado anfitrión
                </th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">No. Placa</th>
                <th className="px-4 py-3">Hora entrada</th>
              </tr>
            </thead>

            <tbody>
              {loadingVehVis && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cargando vehículos de visitantes…
                  </td>
                </tr>
              )}

              {errVehVis && !loadingVehVis && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "#dc2626" }}
                  >
                    Error: {errVehVis}
                  </td>
                </tr>
              )}

              {!loadingVehVis &&
                !errVehVis &&
                visibleVehiculosVisitas.map((v, idx) => (
                  <tr
                    key={safeVehiculoVisitaKey(v, idx)}
                    className={UI.rowHover}
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td
                      className="px-4 py-3 whitespace-nowrap max-w-[160px] sm:max-w-none truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {v.visitante}
                    </td>
                    <td
                      className="px-4 py-3 hidden md:table-cell"
                      style={{ color: "var(--text)" }}
                    >
                      {v.documento || "—"}
                    </td>
                    <td
                      className="px-4 py-3 hidden lg:table-cell"
                      style={{ color: "var(--text)" }}
                    >
                      {v.empresa || "—"}
                    </td>
                    <td
                      className="px-4 py-3 hidden sm:table-cell"
                      style={{ color: "var(--text)" }}
                    >
                      {v.empleadoAnfitrion || "—"}
                    </td>
                    <td
                      className="px-4 py-3 uppercase whitespace-nowrap"
                      style={{ color: "var(--text)" }}
                    >
                      {`${v.vehiculoMarca || ""} ${
                        v.vehiculoModelo || ""
                      }`.trim() || "—"}
                    </td>
                    <td
                      className="px-4 py-3 uppercase whitespace-nowrap"
                      style={{ color: "var(--text)" }}
                    >
                      {v.placa || "—"}
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap"
                      style={{ color: "var(--text)" }}
                    >
                      {v.horaEntrada
                        ? new Date(v.horaEntrada).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}

              {!loadingVehVis &&
                !errVehVis &&
                visibleVehiculosVisitas.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No hay vehículos de visitantes dentro de la empresa en este
                      momento.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={UI.section} style={sxCard()}>
        <div
          className="px-4 py-3 flex flex-col gap-3 border-b sm:flex-row sm:items-start sm:justify-between"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Historial de movimientos manuales
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Registra manualmente entradas, salidas y permisos de empleados y
              vehículos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {registrosFiltrados.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllRegistros((v) => !v)}
                className={UI.btnLink}
                style={{ color: "var(--accent)" }}
              >
                {showAllRegistros
                  ? "Ver solo 5 registros por tabla"
                  : "Ver todos los registros"}
              </button>
            )}

            <button
              type="button"
              className={UI.btnSuccess}
              style={sxSuccessBtn()}
              onClick={() => setShowNuevoMov(true)}
            >
              <span className="text-lg leading-none">＋</span> Registrar permiso
            </button>

            <button
              type="button"
              className={UI.btnInfo}
              style={sxInfoBtn()}
              onClick={() => exportarRegistrosCsv(registrosFiltrados)}
            >
              <span className="text-lg leading-none">⇩</span> Exportar CSV
            </button>

            <button
              type="button"
              className={UI.btnPrimary}
              style={sxPrimaryBtn()}
              onClick={() => exportarRegistrosPdf(registrosFiltrados)}
            >
              <span className="text-lg leading-none">🖨</span> Exportar PDF
            </button>
          </div>
        </div>

        <div
          className="px-4 py-3 flex flex-wrap gap-3 items-end border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="w-full sm:w-auto">
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Empleado
            </label>
            <select
              className="w-full sm:w-40 rounded-[12px] px-2 py-1 text-xs outline-none"
              style={sxInput()}
              value={filterEmpleado}
              onChange={(e) => setFilterEmpleado(e.target.value)}
            >
              <option value="">Todos</option>
              {empleadosList.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.nombreCompleto}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Departamento
            </label>
            <select
              className="w-full sm:w-40 rounded-[12px] px-2 py-1 text-xs outline-none"
              style={sxInput()}
              value={filterDepto}
              onChange={(e) => setFilterDepto(e.target.value)}
            >
              <option value="">Todos</option>
              {deptosDisponibles.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Desde
            </label>
            <input
              type="date"
              className="rounded-[12px] px-2 py-1 text-xs outline-none"
              style={sxInput()}
              value={filterDesde}
              onChange={(e) => setFilterDesde(e.target.value)}
            />
          </div>

          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Hasta
            </label>
            <input
              type="date"
              className="rounded-[12px] px-2 py-1 text-xs outline-none"
              style={sxInput()}
              value={filterHasta}
              onChange={(e) => setFilterHasta(e.target.value)}
            />
          </div>
        </div>

        <div className={UI.tableWrap}>
          <div className={UI.subtleBar} style={sxSectionBar()}>
            Entradas y salidas
          </div>
          <table className={UI.table}>
            <thead style={sxSectionBar()}>
              <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide">
                <th className="px-4 py-3">Fecha/Hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3 hidden sm:table-cell">Observación</th>
              </tr>
            </thead>
            <tbody>
              {visibleRegistrosEntradas.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No hay registros de entradas o salidas con los filtros
                    actuales.
                  </td>
                </tr>
              )}

              {visibleRegistrosEntradas.map((r, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    style={{ color: "var(--text)" }}
                  >
                    {r.fechaHora}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                    {r.tipo}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                    {r.persona || "—"}
                  </td>
                  <td
                    className="px-4 py-3 uppercase"
                    style={{ color: "var(--text)" }}
                  >
                    {r.placa || "—"}
                  </td>
                  <td
                    className="px-4 py-3 hidden sm:table-cell"
                    style={{ color: "var(--text)" }}
                  >
                    {r.observacion || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={UI.tableWrap}>
          <div className={UI.subtleBar} style={sxSectionBar()}>
            Permisos
          </div>
          <table className={UI.table}>
            <thead style={sxSectionBar()}>
              <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide">
                <th className="px-4 py-3">Hora salida</th>
                <th className="px-4 py-3">Hora regreso</th>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3 hidden sm:table-cell">Observación</th>
              </tr>
            </thead>
            <tbody>
              {visibleRegistrosPermisos.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No hay permisos registrados con los filtros actuales.
                  </td>
                </tr>
              )}

              {visibleRegistrosPermisos.map((r, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    style={{ color: "var(--text)" }}
                  >
                    {r.fechaHora}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    style={{ color: "var(--text)" }}
                  >
                    {r.noRegresa ? "✕" : r.fechaFin || "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                    {r.persona || "—"}
                  </td>
                  <td
                    className="px-4 py-3 uppercase"
                    style={{ color: "var(--text)" }}
                  >
                    {r.placa || "—"}
                  </td>
                  <td
                    className="px-4 py-3 hidden sm:table-cell"
                    style={{ color: "var(--text)" }}
                  >
                    {r.observacion || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <NuevoEmpleadoModal
        open={showNewEmp}
        onClose={() => setShowNewEmp(false)}
        onCreated={fetchItems}
        sexos={catalogos.sexos}
        estados={catalogos.estados}
        departamentos={catalogos.departamentos}
        cargos={catalogos.cargos}
      />

      <EditarEmpleadoModal
        empleado={editEmpleado}
        onClose={() => setEditEmpleado(null)}
        onSaved={fetchItems}
        sexos={catalogos.sexos}
        estados={catalogos.estados}
        departamentos={catalogos.departamentos}
        cargos={catalogos.cargos}
      />

      <NuevoVehiculoModal
        open={showNewVeh}
        onClose={() => setShowNewVeh(false)}
        onCreated={fetchItems}
        empleados={empleadosList}
        marcasVehiculos={catalogos.marcasVehiculos}
      />

      <NuevoMovimientoModal
        open={showNuevoMov}
        onClose={() => setShowNuevoMov(false)}
        onCreated={agregarRegistro}
        empleados={empleadosList}
      />

      {showObsModal && (
        <div
          className={UI.modalOverlayTop}
          style={{ background: "rgba(2, 6, 23, 0.5)" }}
        >
          <div
            className="w-full max-w-md rounded-[22px] p-4 sm:p-6"
            style={sxCard()}
          >
            <h2
              className="text-base sm:text-lg font-semibold mb-3 sm:mb-4"
              style={{ color: "var(--text)" }}
            >
              {obsTipo === "ENTRADA" ? "Registrar entrada" : "Registrar salida"}
            </h2>

            <p
              className="text-xs sm:text-sm mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              {obsFila?.empleado?.nombreCompleto || ""}
            </p>

            <div className="space-y-2">
              <label className="block text-sm" style={{ color: "var(--text-muted)" }}>
                Observación
              </label>
              <textarea
                className={UI.fieldInput}
                style={sxInput()}
                rows={3}
                placeholder="Escribe una observación (opcional)"
                value={obsValue}
                onChange={(e) => setObsValue(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
              <button
                type="button"
                className={UI.btnGhost}
                style={sxGhostBtn()}
                onClick={() => {
                  setShowObsModal(false);
                  setObsFila(null);
                  setObsTipo("");
                  setObsValue("");
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={UI.btnSuccess}
                style={sxSuccessBtn()}
                onClick={handleGuardarObs}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ url, name }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || "avatar"}
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover"
      />
    );
  }

  const initials = (name || "—")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full grid place-items-center text-[11px] sm:text-xs font-semibold"
      style={{
        background: "color-mix(in srgb, var(--panel) 76%, transparent)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      {initials || "—"}
    </div>
  );
}

function Pill({ ok, disabled, onClick, okText = "Sí", noText = "No" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] sm:text-xs transition ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{
        background: ok
          ? "color-mix(in srgb, #22c55e 12%, transparent)"
          : "color-mix(in srgb, #ef4444 12%, transparent)",
        color: ok ? "#16a34a" : "#dc2626",
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: ok ? "#16a34a" : "#dc2626" }}
      />
      {ok ? okText : noText}
    </button>
  );
}

function EnEmpresaSwitch({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Pill
        ok={!!value}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        okText="Sí"
        noText="No"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        title="Cambiar estado de En Empresa"
        className="focus:outline-none"
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce"
        >
          <rect width="64" height="64" fill="#0A0F24" />
          <g
            stroke="#2DC4B6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <polyline points="20 36 32 24 44 36" />
            <polyline points="20 28 32 40 44 28" />
          </g>
        </svg>
      </button>
    </div>
  );
}

function validateEmpleadoForm(form) {
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);

  if (!form.nombreCompleto.trim()) {
    errors.push("El nombre completo es obligatorio.");
  } else {
    const letters = form.nombreCompleto.replace(/[^A-Za-zÁÉÍÓÚáéíóúÜüñÑ]/g, "");
    if (letters.length < 8) {
      errors.push("El nombre completo debe tener al menos 8 letras.");
    }
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(form.nombreCompleto.trim())) {
      errors.push("El nombre completo solo debe contener letras y espacios.");
    }
  }

  if (!form.id_persona.trim()) {
    errors.push("El ID Persona es obligatorio.");
  } else if (!/^\d+$/.test(form.id_persona.trim())) {
    errors.push("El ID Persona solo debe contener números.");
  }

  if (!form.departamento.trim()) {
    errors.push("El área / departamento es obligatoria.");
  }

  if (!form.cargo.trim()) {
    errors.push("El cargo es obligatorio.");
  }

  if (!form.sexo || !form.sexo.trim()) {
    errors.push("El sexo es obligatorio.");
  }

  if (!form.dni || !form.dni.trim()) {
    errors.push("El DNI es obligatorio.");
  } else {
    const dniTrim = form.dni.trim();
    const dniPattern = /^\d{4}[-_]\d{4}[-_]\d{5}$/;
    if (!dniPattern.test(dniTrim)) {
      errors.push(
        "El DNI debe tener el formato dddd-dddd-ddddd o dddd_dddd_ddddd (solo números y guiones)."
      );
    }
  }

  if (!form.telefono || !form.telefono.trim()) {
    errors.push("El teléfono es obligatorio.");
  } else {
    const telTrim = form.telefono.trim();
    const telPattern = /^\d{4}[-_]\d{4}$/;
    if (!telPattern.test(telTrim)) {
      errors.push(
        "El teléfono debe tener el formato 1234-5678 o 1234_5678 (8 dígitos, separados por guión)."
      );
    }
  }

  if (!form.direccion || !form.direccion.trim()) {
    errors.push("La dirección es obligatoria.");
  } else {
    const direccionTrim = form.direccion.trim();
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(direccionTrim)) {
      errors.push("La dirección solo debe contener letras y espacios.");
    }
  }

  if (!form.fechaNacimiento) {
    errors.push("La fecha de nacimiento es obligatoria.");
  } else if (form.fechaNacimiento > today) {
    errors.push("La fecha de nacimiento no puede ser futura.");
  }

  if (!form.fechaIngreso) {
    errors.push("La fecha de ingreso es obligatoria.");
  } else if (form.fechaIngreso > today) {
    errors.push("La fecha de ingreso no puede ser futura.");
  }

  if (
    form.fechaNacimiento &&
    form.fechaIngreso &&
    form.fechaIngreso < form.fechaNacimiento
  ) {
    errors.push(
      "La fecha de ingreso no puede ser anterior a la fecha de nacimiento."
    );
  }

  return errors;
}

function NuevoEmpleadoModal({
  open,
  onClose,
  onCreated,
  sexos = [],
  estados = [],
  departamentos = [],
  cargos = [],
}) {
  const INITIAL = {
    nombreCompleto: "",
    id_persona: "",
    dni: "",
    fechaNacimiento: "",
    sexo: "",
    direccion: "",
    telefono: "",
    departamento: "",
    cargo: "",
    fechaIngreso: "",
    estado: "Activo",
  };

  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const errors = validateEmpleadoForm(form);
    if (errors.length) {
      setError(errors.join(" • "));
      setSubmitting(false);
      return;
    }

    try {
      const body = {
        nombreCompleto: form.nombreCompleto.trim(),
        idInterno: form.id_persona.trim(),
        dni: form.dni.trim(),
        fechaNacimiento: form.fechaNacimiento || null,
        sexo: form.sexo || "",
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        fechaIngreso: form.fechaIngreso || null,
        activo: form.estado === "Activo",
      };

      const res = await fetch(`${API_BASE}/acceso/empleados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Error creando empleado");
      }

      onCreated?.(data.item);
      onClose?.();
      setForm(INITIAL);
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={UI.modalOverlay} style={{ background: "rgba(2, 6, 23, 0.5)" }}>
      <div className="w-full max-w-3xl rounded-[22px]" style={sxCard()}>
        <div className={UI.modalHeader} style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
            Registrar Nuevo Empleado
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {error && (
            <div className={UI.mutedBox} style={sxMutedBox()}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Nombre Completo">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.nombreCompleto}
                onChange={(e) => setVal("nombreCompleto", e.target.value)}
                required
              />
            </Field>

            <Field label="ID Persona">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>

            <Field label="DNI">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.dni}
                onChange={(e) => setVal("dni", formatDniInput(e.target.value))}
                maxLength={17}
                required
              />
            </Field>

            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
                required
              />
            </Field>

            <Field label="Sexo">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {sexos.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Teléfono">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.telefono}
                onChange={(e) =>
                  setVal("telefono", formatTelefonoInput(e.target.value))
                }
                maxLength={9}
                required
              />
            </Field>

            <Field label="Dirección" span={2}>
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>

            <Field label="Área / Departamento">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cargo">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {cargos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
                required
              />
            </Field>

            <Field label="Estado">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {estados.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={UI.btnGhost}
              style={sxGhostBtn()}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={UI.btnPrimary}
              style={sxPrimaryBtn()}
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditarEmpleadoModal({
  empleado,
  onClose,
  onSaved,
  sexos = [],
  estados = [],
  departamentos = [],
  cargos = [],
}) {
  const open = !!empleado;

  const initialForm = useMemo(
    () => ({
      nombreCompleto: empleado?.nombreCompleto || "",
      id_persona: empleado?.id_persona || "",
      dni: empleado?.dni || "",
      fechaNacimiento: empleado?.fechaNacimiento
        ? (() => {
            try {
              return new Date(empleado.fechaNacimiento).toISOString().slice(0, 10);
            } catch {
              return "";
            }
          })()
        : "",
      sexo: empleado?.sexo || "",
      direccion: empleado?.direccion || "",
      telefono: empleado?.telefono || "",
      departamento: empleado?.departamento || "",
      cargo: empleado?.cargo || "",
      fechaIngreso: empleado?.fechaIngreso
        ? (() => {
            try {
              return new Date(empleado.fechaIngreso).toISOString().slice(0, 10);
            } catch {
              return "";
            }
          })()
        : "",
      estado: empleado?.activo ? "Activo" : "Inactivo",
    }),
    [empleado]
  );

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialForm);
    setError("");
  }, [initialForm]);

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  if (!open) return null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const errors = validateEmpleadoForm(form);
    if (errors.length) {
      setError(errors.join(" • "));
      setSaving(false);
      return;
    }

    try {
      const body = {
        nombreCompleto: form.nombreCompleto.trim(),
        idInterno: form.id_persona.trim(),
        dni: form.dni.trim(),
        fechaNacimiento: form.fechaNacimiento || null,
        sexo: form.sexo || "",
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        fechaIngreso: form.fechaIngreso || null,
        activo: form.estado === "Activo",
      };

      const res = await fetch(`${API_BASE}/acceso/empleados/${empleado._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo actualizar el empleado");
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={UI.modalOverlay} style={{ background: "rgba(2, 6, 23, 0.5)" }}>
      <div className="w-full max-w-3xl rounded-[22px]" style={sxCard()}>
        <div className={UI.modalHeader} style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
            Editar Empleado
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {error && (
            <div className={UI.mutedBox} style={sxMutedBox()}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Nombre Completo">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.nombreCompleto}
                onChange={(e) => setVal("nombreCompleto", e.target.value)}
                required
              />
            </Field>

            <Field label="ID Persona">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>

            <Field label="DNI">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.dni}
                onChange={(e) => setVal("dni", formatDniInput(e.target.value))}
                maxLength={17}
                required
              />
            </Field>

            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
                required
              />
            </Field>

            <Field label="Sexo">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {sexos.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Teléfono">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.telefono}
                onChange={(e) =>
                  setVal("telefono", formatTelefonoInput(e.target.value))
                }
                maxLength={9}
                required
              />
            </Field>

            <Field label="Dirección" span={2}>
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>

            <Field label="Área / Departamento">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cargo">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {cargos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
                required
              />
            </Field>

            <Field label="Estado">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {estados.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={UI.btnGhost}
              style={sxGhostBtn()}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={UI.btnPrimary}
              style={sxPrimaryBtn()}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NuevoVehiculoModal({
  open,
  onClose,
  onCreated,
  empleados,
  marcasVehiculos = [],
}) {
  const INITIAL = {
    empleadoId: "",
    marca: "",
    modelo: "",
    placa: "",
    enEmpresa: false,
  };

  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modelosDisponibles, setModelosDisponibles] = useState([]);
  const [loadingModelos, setLoadingModelos] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError("");
      setModelosDisponibles([]);
    }
  }, [open]);

  useEffect(() => {
    let cancel = false;

    async function loadModelos() {
      if (!form.marca) {
        setModelosDisponibles([]);
        return;
      }

      setLoadingModelos(true);

      try {
        const res = await fetch(
          `${CATALOGS.modelosVehiculos}?marca=${encodeURIComponent(form.marca)}`,
          {
            credentials: "include",
            headers: { Accept: "application/json" },
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "No se pudieron cargar modelos");
        }

        const items = normalizeCatalogItems(data);
        if (!cancel) setModelosDisponibles(items);
      } catch (e) {
        console.warn("[NuevoVehiculoModal] error cargando modelos:", e);
        if (!cancel) setModelosDisponibles([]);
      } finally {
        if (!cancel) setLoadingModelos(false);
      }
    }

    loadModelos();

    return () => {
      cancel = true;
    };
  }, [form.marca]);

  if (!open) return null;

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!form.empleadoId || !form.marca || !form.modelo || !form.placa.trim()) {
        setError("Todos los campos son obligatorios.");
        setSaving(false);
        return;
      }

      const placaTrim = form.placa.trim().toUpperCase();
      if (!/^[A-Za-z0-9]{7}$/.test(placaTrim)) {
        setError("La placa debe tener exactamente 7 caracteres alfanuméricos.");
        setSaving(false);
        return;
      }

      const body = {
        empleado: form.empleadoId,
        marca: form.marca,
        modelo: form.modelo.trim(),
        placa: placaTrim,
        enEmpresa: !!form.enEmpresa,
      };

      const res = await fetch(`${API_BASE}/acceso/vehiculos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo crear el vehículo");
      }

      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={UI.modalOverlay} style={{ background: "rgba(2, 6, 23, 0.5)" }}>
      <div className="w-full max-w-xl rounded-[22px]" style={sxCard()}>
        <div className={UI.modalHeader} style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
            Registrar Nuevo Vehículo
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {error && (
            <div className={UI.mutedBox} style={sxMutedBox()}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <Field label="Empleado">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.empleadoId}
                onChange={(e) => setVal("empleadoId", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {empleados.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.nombreCompleto} {e.id_persona ? `(${e.id_persona})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Marca">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.marca}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((s) => ({ ...s, marca: value, modelo: "" }));
                }}
                required
              >
                <option value="">- Seleccionar -</option>
                {marcasVehiculos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modelo">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.modelo}
                onChange={(e) => setVal("modelo", e.target.value)}
                required
                disabled={!form.marca || loadingModelos}
              >
                <option value="">
                  {loadingModelos ? "Cargando modelos..." : "- Seleccionar -"}
                </option>
                {modelosDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Placa">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.placa}
                onChange={(e) => setVal("placa", e.target.value)}
                maxLength={7}
                placeholder="7 caracteres alfanuméricos"
                required
              />
            </Field>

            <div className="flex items-center gap-2">
              <input
                id="enEmpresaChk"
                type="checkbox"
                className="h-4 w-4"
                checked={form.enEmpresa}
                onChange={(e) => setVal("enEmpresa", e.target.checked)}
              />
              <label
                htmlFor="enEmpresaChk"
                className="text-sm"
                style={{ color: "var(--text)" }}
              >
                En Empresa
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={UI.btnGhost}
              style={sxGhostBtn()}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={UI.btnSuccess}
              style={sxSuccessBtn()}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NuevoMovimientoModal({ open, onClose, onCreated, empleados }) {
  const PERMISO_LABEL = "Permiso";

  const personaOptions = useMemo(() => {
    return empleados.map((e) => ({
      value: e._id,
      label: e.nombreCompleto,
    }));
  }, [empleados]);

  const INITIAL = {
    tipo: "PERMISO",
    personaId: "",
    placa: "",
    observacion: "",
    fechaHora: "",
    fechaFin: "",
    noRegresa: false,
  };

  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  function validar() {
    const errs = [];
    if (!form.personaId) errs.push("Debe seleccionar un empleado");
    if (!form.fechaHora) errs.push("La hora de salida es obligatoria");
    if (!form.noRegresa && !form.fechaFin) {
      errs.push("La hora de regreso es obligatoria si el empleado regresa");
    }
    if (!form.observacion.trim()) errs.push("La observación es obligatoria");
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const errs = validar();
    if (errs.length) {
      setError(errs.join(" • "));
      setSubmitting(false);
      return;
    }

    const empleadoSel = empleados.find((e) => e._id === form.personaId);
    const personaNombre = empleadoSel?.nombreCompleto || "";
    const depto = empleadoSel?.departamento || "";
    const salidaLocal = form.fechaHora
      ? formatDateTime(new Date(form.fechaHora))
      : "";
    const regresoLocal = form.fechaFin
      ? formatDateTime(new Date(form.fechaFin))
      : "";
    const fechaIso = form.fechaHora
      ? new Date(form.fechaHora).toISOString().slice(0, 10)
      : "";

    const nuevoRegistro = {
      fechaHora: salidaLocal,
      fechaFin: form.noRegresa ? undefined : regresoLocal,
      noRegresa: !!form.noRegresa,
      tipo: PERMISO_LABEL,
      persona: personaNombre,
      personaId: form.personaId,
      departamento: depto,
      placa: form.placa.trim().toUpperCase(),
      observacion: form.observacion.trim(),
      fechaIso,
    };

    onCreated?.(nuevoRegistro);
    onClose?.();
    setSubmitting(false);
  }

  return (
    <div className={UI.modalOverlayHigh} style={{ background: "rgba(2, 6, 23, 0.5)" }}>
      <div className="w-full max-w-xl rounded-[22px]" style={sxCard()}>
        <div className={UI.modalHeader} style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
            Registrar Permiso
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {error && (
            <div className={UI.mutedBox} style={sxMutedBox()}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Tipo">
              <input
                type="text"
                className={UI.fieldInput}
                style={sxInput({ color: "var(--text-muted)" })}
                value={PERMISO_LABEL}
                readOnly
              />
            </Field>

            <Field label="Empleado">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.personaId}
                onChange={(e) => setVal("personaId", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {personaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Placa del vehículo (opcional)">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.placa}
                onChange={(e) => setVal("placa", e.target.value)}
              />
            </Field>

            <Field label="Hora de salida (inicio)">
              <input
                type="datetime-local"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaHora}
                onChange={(e) => setVal("fechaHora", e.target.value)}
                required
              />
            </Field>

            <Field label="Hora de regreso (fin)">
              <input
                type="datetime-local"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaFin}
                onChange={(e) => setVal("fechaFin", e.target.value)}
                disabled={form.noRegresa}
                required={!form.noRegresa}
              />
            </Field>

            <Field label="No regresa">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="noRegresaCheckbox"
                  checked={form.noRegresa}
                  onChange={(e) => setVal("noRegresa", e.target.checked)}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="noRegresaCheckbox"
                  className="text-sm"
                  style={{ color: "var(--text)" }}
                >
                  No regresa
                </label>
              </div>
            </Field>

            <Field label="Observación" span={2}>
              <textarea
                className={UI.fieldInput}
                style={sxInput()}
                rows={3}
                value={form.observacion}
                onChange={(e) => setVal("observacion", e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={UI.btnGhost}
              style={sxGhostBtn()}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={UI.btnSuccess}
              style={sxSuccessBtn()}
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, span = 1 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? "md:col-span-2" : ""}`}>
      <label className={UI.label} style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}