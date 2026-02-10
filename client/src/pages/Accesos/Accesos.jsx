// client/src/pages/Accesos.jsx
import { useEffect, useMemo, useState } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api"
).replace(/\/$/, "");

// Normaliza empleados + vehículos desde la API
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
      // Para edición
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
        _id:
          `${e._id}-${
            v._id || v.placa || Math.random().toString(36).slice(2)
          }`,
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

// Formatea un objeto Date en el formato "dd/mm/aaaa hh:mm".
function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Autoformato de DNI: dddd-dddd-ddddd
function formatDniInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let part1 = digits.slice(0, 4);
  let part2 = digits.slice(4, 8);
  let part3 = digits.slice(8, 13);
  if (digits.length <= 4) {
    return part1;
  }
  if (digits.length <= 8) {
    return `${part1}-${part2}`;
  }
  return `${part1}-${part2}-${part3}`;
}

// Autoformato de teléfono: dddd-dddd
function formatTelefonoInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let part1 = digits.slice(0, 4);
  let part2 = digits.slice(4, 8);
  if (digits.length <= 4) {
    return part1;
  }
  return `${part1}-${part2}`;
}

export default function Accesos() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showNewEmp, setShowNewEmp] = useState(false);
  // Empleado actualmente seleccionado para edición. Cuando es null el modal está cerrado.
  const [editEmpleado, setEditEmpleado] = useState(null);
  const [showNewVeh, setShowNewVeh] = useState(false);

  // Vehículos de visitas
  const [vehiculosVisitas, setVehiculosVisitas] = useState([]);
  const [loadingVehVis, setLoadingVehVis] = useState(true);
  const [errVehVis, setErrVehVis] = useState("");

  // Flags para mostrar últimos 5 / todos
  const [showAllAccesos, setShowAllAccesos] = useState(false);
  const [showAllVehVis, setShowAllVehVis] = useState(false);
  const [showAllRegistros, setShowAllRegistros] = useState(false);

  // Historial manual de movimientos
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
    } catch (_) {
      /* ignore */
    }
    return [];
  });
  const [showNuevoMov, setShowNuevoMov] = useState(false);

  // Modal obs
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsTipo, setObsTipo] = useState("");
  const [obsFila, setObsFila] = useState(null);
  const [obsValue, setObsValue] = useState("");

  // Filtros historial
  const [filterEmpleado, setFilterEmpleado] = useState("");
  const [filterDepto, setFilterDepto] = useState("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

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

  // Exportar CSV
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
        f
          .map((item) => `"${String(item || "").replace(/\"/g, '""')}"`)
          .join(",")
      );
    });
    if (filasEntradas.length && filasPermisos.length) lines.push("");
    if (filasPermisos.length) {
      lines.push(headerPermisos.map((h) => `"${h}"`).join(","));
      filasPermisos.forEach((f) => {
        lines.push(
          f
            .map((item) => `"${String(item || "").replace(/\"/g, '""')}"`)
            .join(",")
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

  // Exportar PDF
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
    } catch (_) {
      // ignore error en backend, de todos modos guardamos local
    }
    setRegistros((prev) => [registro, ...prev]);
    try {
      const stored = localStorage.getItem("movimientosManual");
      const arr = stored ? JSON.parse(stored) : [];
      arr.unshift(registro);
      localStorage.setItem("movimientosManual", JSON.stringify(arr));
    } catch (_) {
      /* ignore */
    }
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
          localStorage.setItem(
            "movimientosManual",
            JSON.stringify(convertidos)
          );
        } catch (_) {}
        return;
      }
      // Si backend no devuelve nada, usamos localStorage
      try {
        const stored = localStorage.getItem("movimientosManual");
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) {
            setRegistros(arr);
          }
        }
      } catch (_) {}
    } catch (error) {
      console.error("Error al cargar movimientos manuales", error);
      try {
        const stored = localStorage.getItem("movimientosManual");
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) {
            setRegistros(arr);
          }
        }
      } catch (_) {}
    }
  }

  async function crearRegistroManual(registro) {
    try {
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
        throw new Error(
          data?.error || "No se pudo crear el movimiento manual"
        );
      }
    } catch (error) {
      throw error;
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
      if (
        !res.ok ||
        data?.ok === false ||
        !Array.isArray(data?.items)
      ) {
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
      const res = await fetch(
        `${API_BASE}/visitas/vehiculos-en-sitio`,
        {
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (
        !res.ok ||
        data?.ok === false ||
        !Array.isArray(data?.items)
      ) {
        throw new Error(
          data?.error || data?.message || "Error de API"
        );
      }
      setVehiculosVisitas(data.items);
    } catch (e) {
      console.error(e);
      setErrVehVis(
        e.message || "Error al cargar vehículos de visitas"
      );
      setVehiculosVisitas([]);
    } finally {
      setLoadingVehVis(false);
    }
  }

  const visibleVehiculosVisitas = useMemo(() => {
    if (showAllVehVis) return vehiculosVisitas;
    if (vehiculosVisitas.length <= 5) return vehiculosVisitas;
    return vehiculosVisitas.slice(0, 5); // aquí tiene más sentido los primeros 5 (los más recientes según el sort del backend)
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
          data?.error ||
            "No se pudo actualizar el estado del vehículo"
        );
      }
      await fetchItems();
    } catch (e) {
      console.error(e);
      alert(e.message || "Error actualizando vehículo");
    }
  }

  async function handleToggleActivo(row, nextValue) {
    const empId = row?.empleado?._id;
    if (!empId) return;
    try {
      let res = await fetch(
        `${API_BASE}/acceso/empleados/${empId}/activo`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ activo: nextValue }),
        }
      );
      if (res.status === 404) {
        res = await fetch(`${API_BASE}/acceso/empleados/${empId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ activo: nextValue }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "No se pudo actualizar el empleado"
        );
      }
      await fetchItems();
    } catch (e) {
      console.error(e);
      alert(e.message || "Error actualizando empleado");
    }
  }

  async function handleDeleteEmpleado(empleado) {
    if (!empleado?._id) return;
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar a “${
        empleado.nombreCompleto || "este empleado"
      }"? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;
    try {
      const res = await fetch(
        `${API_BASE}/acceso/empleados/${empleado._id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "No se pudo eliminar el empleado"
        );
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
    return Array.from(set).sort();
  }, [empleadosList]);

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
    <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Encabezado */}
      <div className="mb-2 sm:mb-4">
        <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">
          Control de Acceso
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Registro de personal y vehículos.
        </p>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium bg-sky-600 hover:bg-sky-500 transition"
            onClick={() => setShowNewEmp(true)}
          >
            <span className="text-lg sm:text-xl leading-none">＋</span> Nuevo
            Empleado
          </button>
          <button
            type="button"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-500 transition"
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
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 sm:px-4 py-2 text-xs sm:text-sm outline-none focus:border-sky-500"
          />
          <span className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            Ctrl/⌘+K
          </span>
        </div>
      </div>

      {/* Tabla: PERSONAL Y VEHÍCULOS DE EMPLEADOS */}
      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur">
        <div className="flex justify-end px-4 pt-3">
          {filtered.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllAccesos((v) => !v)}
              className="text-[11px] sm:text-xs text-sky-300 hover:text-sky-200"
            >
              {showAllAccesos
                ? "Ver solo últimos 5 registros"
                : "Ver todos los registros"}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="text-left text-gray-300 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                  Foto
                </th>
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
            <tbody className="divide-y divide-white/10">
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    Cargando…
                  </td>
                </tr>
              )}
              {err && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-red-400"
                  >
                    Error: {err}
                  </td>
                </tr>
              )}
              {!loading && !err && visibleAccesos.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    Sin resultados.
                  </td>
                </tr>
              )}
              {!loading &&
                !err &&
                visibleAccesos.map((row) => (
                  <tr key={row._id} className="align-middle">
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Avatar
                        url={row?.empleado?.fotoUrl}
                        name={row?.empleado?.nombreCompleto}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[160px] sm:max-w-none">
                          {row?.empleado?.nombreCompleto || "—"}
                        </span>
                        {/* info secundaria en móvil */}
                        <span className="md:hidden text-[11px] text-gray-400">
                          {row?.empleado?.departamento || "Sin depto"} ·{" "}
                          {row?.empleado?.id_persona || "Sin ID"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {row?.empleado?.id_persona || "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {row?.empleado?.departamento || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row?.vehiculo?.modelo || "—"}
                    </td>
                    <td className="px-4 py-3">
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
                    {/* Botones rápidos para registrar entrada o salida */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          title="Registrar entrada"
                          className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 animate-bounce text-[11px] sm:text-xs"
                          onClick={() =>
                            registrarMovimientoRapido("ENTRADA", row)
                          }
                        >
                          Entrada
                        </button>
                        <button
                          type="button"
                          title="Registrar salida"
                          className="px-2 py-1 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/40 animate-bounce text-[11px] sm:text-xs"
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
                        {/* Botón para editar el empleado */}
                        <button
                          title="Editar empleado"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
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
                        {/* Botón para eliminar el empleado */}
                        <button
                          title="Eliminar empleado"
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300"
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
                              <rect
                                x="20"
                                y="22"
                                width="24"
                                height="26"
                                rx="4"
                              />
                              <line x1="26" y1="28" x2="26" y2="44" />
                              <line x1="32" y1="28" x2="32" y2="44" />
                              <line x1="38" y1="28" x2="38" y2="44" />
                            </g>
                          </svg>
                        </button>

                        {/* En móvil mostramos los botones Entrada / Salida aquí */}
                        <div className="flex sm:hidden w-full justify-start gap-1 mt-1">
                          <button
                            type="button"
                            title="Registrar entrada"
                            className="flex-1 px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 text-[11px]"
                            onClick={() =>
                              registrarMovimientoRapido("ENTRADA", row)
                            }
                          >
                            Entrada
                          </button>
                          <button
                            type="button"
                            title="Registrar salida"
                            className="flex-1 px-2 py-1 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/40 text-[11px]"
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
        <div className="px-4 py-3 text-[11px] sm:text-xs text-gray-400">
          Consejo: “En Empresa” indica si el vehículo del empleado está dentro
          del estacionamiento. Haz clic en la flecha para actualizar su estado.
        </div>
      </div>

      {/* Vehículos de visitantes */}
      <section className="mt-4 sm:mt-6 rounded-2xl bg-slate-900/70 border border-slate-700/60 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Vehículos de visitantes en el estacionamiento
            </h2>
            <p className="text-xs text-slate-400">
              Información tomada del módulo de Visitas (solo visitas con estado
              “Dentro” y que llegaron en vehículo).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {vehiculosVisitas.length} vehículos
            </span>
            {vehiculosVisitas.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllVehVis((v) => !v)}
                className="text-[11px] sm:text-xs text-sky-300 hover:text-sky-200"
              >
                {showAllVehVis
                  ? "Ver solo 5 registros"
                  : "Ver todos los registros"}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-slate-400">
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
            <tbody className="divide-y divide-slate-800">
              {loadingVehVis && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-slate-400"
                  >
                    Cargando vehículos de visitantes…
                  </td>
                </tr>
              )}
              {errVehVis && !loadingVehVis && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-rose-300"
                  >
                    Error: {errVehVis}
                  </td>
                </tr>
              )}
              {!loadingVehVis &&
                !errVehVis &&
                visibleVehiculosVisitas.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-100 whitespace-nowrap max-w-[160px] sm:max-w-none truncate">
                      {v.visitante}
                    </td>
                    <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                      {v.documento || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 hidden lg:table-cell">
                      {v.empresa || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                      {v.empleadoAnfitrion || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 uppercase whitespace-nowrap">
                      {`${v.vehiculoMarca || ""} ${
                        v.vehiculoModelo || ""
                      }`.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 uppercase whitespace-nowrap">
                      {v.placa || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
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
                      className="px-4 py-6 text-center text-sm text-slate-400"
                    >
                      No hay vehículos de visitantes dentro de la empresa en
                      este momento.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Historial manual de movimientos */}
      <section className="mt-4 sm:mt-6 rounded-2xl bg-slate-900/70 border border-slate-700/60 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/70 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Historial de movimientos manuales
            </h2>
            <p className="text-xs text-slate-400">
              Registra manualmente entradas, salidas y permisos de empleados y
              vehículos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {registrosFiltrados.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllRegistros((v) => !v)}
                className="text-[11px] sm:text-xs text-sky-300 hover:text-sky-200"
              >
                {showAllRegistros
                  ? "Ver solo 5 registros por tabla"
                  : "Ver todos los registros"}
              </button>
            )}
            <button
              type="button"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 transition"
              onClick={() => setShowNuevoMov(true)}
            >
              <span className="text-lg leading-none">＋</span> Registrar permiso
            </button>
            <button
              type="button"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 transition"
              onClick={() => exportarRegistrosCsv(registrosFiltrados)}
            >
              <span className="text-lg leading-none">⇩</span> Exportar CSV
            </button>
            <button
              type="button"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 transition"
              onClick={() => exportarRegistrosPdf(registrosFiltrados)}
            >
              <span className="text-lg leading-none">🖨</span> Exportar PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-slate-700/70 flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-auto">
            <label className="block text-xs text-slate-400 mb-1">
              Empleado
            </label>
            <select
              className="w-full sm:w-40 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100 text-xs"
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
            <label className="block text-xs text-slate-400 mb-1">
              Departamento
            </label>
            <select
              className="w-full sm:w-40 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100 text-xs"
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
            <label className="block text-xs text-slate-400 mb-1">
              Desde
            </label>
            <input
              type="date"
              className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100 text-xs"
              value={filterDesde}
              onChange={(e) => setFilterDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Hasta
            </label>
            <input
              type="date"
              className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100 text-xs"
              value={filterHasta}
              onChange={(e) => setFilterHasta(e.target.value)}
            />
          </div>
        </div>

        {/* Entradas y salidas */}
        <div className="overflow-x-auto">
          <div className="px-4 py-2 bg-slate-800 text-slate-300 uppercase text-[11px] sm:text-xs font-semibold">
            Entradas y salidas
          </div>
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Fecha/Hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3 hidden sm:table-cell">
                  Observación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleRegistrosEntradas.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-slate-400"
                  >
                    No hay registros de entradas o salidas con los filtros
                    actuales.
                  </td>
                </tr>
              )}
              {visibleRegistrosEntradas.map((r, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-100 whitespace-nowrap">
                    {r.fechaHora}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.tipo}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.persona || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 uppercase">
                    {r.placa || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {r.observacion || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permisos */}
        <div className="overflow-x-auto">
          <div className="px-4 py-2 bg-slate-800 text-slate-300 uppercase text-[11px] sm:text-xs font-semibold">
            Permisos
          </div>
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Hora salida</th>
                <th className="px-4 py-3">Hora regreso</th>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3 hidden sm:table-cell">
                  Observación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleRegistrosPermisos.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-slate-400"
                  >
                    No hay permisos registrados con los filtros actuales.
                  </td>
                </tr>
              )}
              {visibleRegistrosPermisos.map((r, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-100 whitespace-nowrap">
                    {r.fechaHora}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {r.noRegresa ? "✕" : r.fechaFin || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.persona || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 uppercase">
                    {r.placa || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {r.observacion || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modales */}
      <NuevoEmpleadoModal
        open={showNewEmp}
        onClose={() => setShowNewEmp(false)}
        onCreated={fetchItems}
      />
      <EditarEmpleadoModal
        empleado={editEmpleado}
        onClose={() => setEditEmpleado(null)}
        onSaved={fetchItems}
      />
      <NuevoVehiculoModal
        open={showNewVeh}
        onClose={() => setShowNewVeh(false)}
        onCreated={fetchItems}
        empleados={empleadosList}
      />
      <NuevoMovimientoModal
        open={showNuevoMov}
        onClose={() => setShowNuevoMov(false)}
        onCreated={agregarRegistro}
        empleados={empleadosList}
      />
      {/* Modal de observación para entradas/salidas */}
      {showObsModal && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 px-3">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-xl p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
              {obsTipo === "ENTRADA"
                ? "Registrar entrada"
                : "Registrar salida"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-3">
              {obsFila?.empleado?.nombreCompleto || ""}
            </p>
            <div className="space-y-2">
              <label className="block text-sm text-slate-300">
                Observación
              </label>
              <textarea
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                rows={3}
                placeholder="Escribe una observación (opcional)"
                value={obsValue}
                onChange={(e) => setObsValue(e.target.value)}
              ></textarea>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm"
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
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
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

// Helpers UI
function Avatar({ url, name }) {
  if (url)
    return (
      <img
        src={url}
        alt={name || "avatar"}
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover"
      />
    );
  const initials = (name || "—")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/10 grid place-items-center text-[11px] sm:text-xs font-semibold">
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
        ok
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-rose-500/15 text-rose-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          ok ? "bg-emerald-400" : "bg-rose-400"
        }`}
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

function EstadoSwitch({ value, onChange }) {
  return (
    <Pill
      ok={!!value}
      onClick={() => onChange(!value)}
      okText="Activo"
      noText="Inactivo"
    />
  );
}

// Constantes y validaciones
const SEXOS = ["Femenino", "Masculino", "Otro"];
const ESTADOS = ["Activo", "Inactivo"];
const DEPTOS_SUGERIDOS = [
  "Ingeniería",
  "Ventas",
  "Administración",
  "Logística",
  "Seguridad",
];
const CARGOS_SUGERIDOS = [
  "Guardia de seguridad",
  "Supervisor de seguridad",
  "Jefe de seguridad",
  "Operador de CCTV",
  "Recepcionista",
  "Administrativo",
  "Jefe de área",
  "Mantenimiento",
];

const MARCAS_SUGERIDAS = [
  "Toyota",
  "Honda",
  "Nissan",
  "Ford",
  "Chevrolet",
  "Hyundai",
  "Kia",
  "Mazda",
  "Volkswagen",
  "BMW",
];

const MODELOS_POR_MARCA = {
  Toyota: ["Corolla", "Hilux", "Prado", "Camry", "RAV4"],
  Honda: ["Civic", "CR-V", "Accord"],
  Nissan: ["Sentra", "X-Trail", "Altima", "Navara"],
  Ford: ["Ranger", "F-150", "Explorer"],
  Chevrolet: ["Silverado", "Tahoe", "Camaro"],
  Hyundai: ["Tucson", "Elantra", "Santa Fe"],
  Kia: ["Sportage", "Sorento", "Rio"],
  Mazda: ["CX-5", "3", "BT-50"],
  Volkswagen: ["Golf", "Tiguan", "Amarok"],
  BMW: ["X5", "3 Series", "5 Series"],
};

function validateEmpleadoForm(form) {
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  if (!form.nombreCompleto.trim()) {
    errors.push("El nombre completo es obligatorio.");
  } else {
    const letters = form.nombreCompleto.replace(
      /[^A-Za-zÁÉÍÓÚáéíóúÜüñÑ]/g,
      ""
    );
    if (letters.length < 8) {
      errors.push("El nombre completo debe tener al menos 8 letras.");
    }
    if (
      !/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(form.nombreCompleto.trim())
    ) {
      errors.push(
        "El nombre completo solo debe contener letras y espacios."
      );
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

function NuevoEmpleadoModal({ open, onClose, onCreated }) {
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
      if (!res.ok || data?.ok === false)
        throw new Error(data?.error || "Error creando empleado");
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-3">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            Registrar Nuevo Empleado
          </h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-6 py-4 sm:py-5 space-y-4"
        >
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-xs sm:text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Nombre Completo">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.nombreCompleto}
                onChange={(e) =>
                  setVal("nombreCompleto", e.target.value)
                }
                required
              />
            </Field>
            <Field label="ID Persona">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>
            <Field label="DNI">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.dni}
                onChange={(e) =>
                  setVal("dni", formatDniInput(e.target.value))
                }
                maxLength={17}
                required
              />
            </Field>
            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.fechaNacimiento}
                onChange={(e) =>
                  setVal("fechaNacimiento", e.target.value)
                }
                required
              />
            </Field>
            <Field label="Sexo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>
            <Field label="Área / Departamento">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.departamento}
                onChange={(e) =>
                  setVal("departamento", e.target.value)
                }
                required
              >
                <option value="">- Seleccionar -</option>
                {DEPTOS_SUGERIDOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cargo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {CARGOS_SUGERIDOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.fechaIngreso}
                onChange={(e) =>
                  setVal("fechaIngreso", e.target.value)
                }
                required
              />
            </Field>
            <Field label="Estado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {ESTADOS.map((s) => (
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
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 text-sm"
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

function EditarEmpleadoModal({ empleado, onClose, onSaved }) {
  const open = !!empleado;
  const initialForm = useMemo(
    () => ({
      nombreCompleto: empleado?.nombreCompleto || "",
      id_persona: empleado?.id_persona || "",
      dni: empleado?.dni || "",
      fechaNacimiento: empleado?.fechaNacimiento
        ? (() => {
            try {
              return new Date(empleado.fechaNacimiento)
                .toISOString()
                .slice(0, 10);
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
              return new Date(empleado.fechaIngreso)
                .toISOString()
                .slice(0, 10);
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
  const cargosOptions = useMemo(() => {
    if (!form.cargo || CARGOS_SUGERIDOS.includes(form.cargo)) {
      return CARGOS_SUGERIDOS;
    }
    return [form.cargo, ...CARGOS_SUGERIDOS];
  }, [form.cargo]);
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
      const res = await fetch(
        `${API_BASE}/acceso/empleados/${empleado._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false)
        throw new Error(
          data?.error || "No se pudo actualizar el empleado"
        );
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-3">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            Editar Empleado
          </h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSave}
          className="px-4 sm:px-6 py-4 sm:py-5 space-y-4"
        >
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-xs sm:text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Nombre Completo">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.nombreCompleto}
                onChange={(e) =>
                  setVal("nombreCompleto", e.target.value)
                }
                required
              />
            </Field>
            <Field label="ID Persona">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>
            <Field label="DNI">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.dni}
                onChange={(e) =>
                  setVal("dni", formatDniInput(e.target.value))
                }
                maxLength={17}
                required
              />
            </Field>
            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.fechaNacimiento}
                onChange={(e) =>
                  setVal("fechaNacimiento", e.target.value)
                }
                required
              />
            </Field>
            <Field label="Sexo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>
            <Field label="Área / Departamento">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.departamento}
                onChange={(e) =>
                  setVal("departamento", e.target.value)
                }
                required
              >
                <option value="">- Seleccionar -</option>
                {DEPTOS_SUGERIDOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cargo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {cargosOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.fechaIngreso}
                onChange={(e) =>
                  setVal("fechaIngreso", e.target.value)
                }
                required
              />
            </Field>
            <Field label="Estado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {ESTADOS.map((s) => (
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
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 text-sm"
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

function NuevoVehiculoModal({ open, onClose, onCreated, empleados }) {
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
  const modelosDisponibles = useMemo(() => {
    if (!form.marca) return [];
    return MODELOS_POR_MARCA[form.marca] || [];
  }, [form.marca]);
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
    setSaving(true);
    setError("");
    try {
      if (
        !form.empleadoId ||
        !form.marca ||
        !form.modelo ||
        !form.placa.trim()
      ) {
        setError("Todos los campos son obligatorios.");
        setSaving(false);
        return;
      }
      const placaTrim = form.placa.trim().toUpperCase();
      if (!/^[A-Za-z0-9]{7}$/.test(placaTrim)) {
        setError(
          "La placa debe tener exactamente 7 caracteres alfanuméricos."
        );
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
      if (!res.ok || data?.ok === false)
        throw new Error(
          data?.error || "No se pudo crear el vehículo"
        );
      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-3">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            Registrar Nuevo Vehículo
          </h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-6 py-4 sm:py-5 space-y-4"
        >
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-xs sm:text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <Field label="Empleado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.empleadoId}
                onChange={(e) =>
                  setVal("empleadoId", e.target.value)
                }
                required
              >
                <option value="">- Seleccionar -</option>
                {empleados.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.nombreCompleto}{" "}
                    {e.id_persona ? `(${e.id_persona})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Marca">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.marca}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((s) => ({ ...s, marca: value, modelo: "" }));
                }}
                required
              >
                <option value="">- Seleccionar -</option>
                {MARCAS_SUGERIDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modelo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.modelo}
                onChange={(e) =>
                  setVal("modelo", e.target.value)
                }
                required
                disabled={!form.marca || modelosDisponibles.length === 0}
              >
                <option value="">- Seleccionar -</option>
                {modelosDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Placa">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
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
                onChange={(e) =>
                  setVal("enEmpresa", e.target.checked)
                }
              />
              <label
                htmlFor="enEmpresaChk"
                className="text-sm text-slate-200"
              >
                En Empresa
              </label>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
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
    if (!form.personaId) {
      errs.push("Debe seleccionar un empleado");
    }
    if (!form.fechaHora) {
      errs.push("La hora de salida es obligatoria");
    }
    if (!form.noRegresa && !form.fechaFin) {
      errs.push(
        "La hora de regreso es obligatoria si el empleado regresa"
      );
    }
    if (!form.observacion.trim()) {
      errs.push("La observación es obligatoria");
    }
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
    const empleadoSel = empleados.find(
      (e) => e._id === form.personaId
    );
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-3">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            Registrar Permiso
          </h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-6 py-4 sm:py-5 space-y-4"
        >
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-xs sm:text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Tipo">
              <input
                type="text"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-400 text-sm"
                value={PERMISO_LABEL}
                readOnly
              />
            </Field>
            <Field label="Empleado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.personaId}
                onChange={(e) =>
                  setVal("personaId", e.target.value)
                }
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.placa}
                onChange={(e) =>
                  setVal("placa", e.target.value)
                }
              />
            </Field>
            <Field label="Hora de salida (inicio)">
              <input
                type="datetime-local"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.fechaHora}
                onChange={(e) =>
                  setVal("fechaHora", e.target.value)
                }
                required
              />
            </Field>
            <Field label="Hora de regreso (fin)">
              <input
                type="datetime-local"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                value={form.fechaFin}
                onChange={(e) =>
                  setVal("fechaFin", e.target.value)
                }
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
                  onChange={(e) =>
                    setVal("noRegresa", e.target.checked)
                  }
                  className="h-4 w-4"
                />
                <label
                  htmlFor="noRegresaCheckbox"
                  className="text-sm text-slate-200"
                >
                  No regresa
                </label>
              </div>
            </Field>
            <Field label="Observación" span={2}>
              <textarea
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
                rows={3}
                value={form.observacion}
                onChange={(e) =>
                  setVal("observacion", e.target.value)
                }
                required
              ></textarea>
            </Field>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
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
      <label className="text-xs sm:text-sm text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}
