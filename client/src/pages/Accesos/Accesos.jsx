import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { api } from "../../lib/api";

import {
  CATALOGS,
  PERMS,
  UI,
} from "./utils/accesos.constants.js";

import {
  fetchCatalog,
  formatDateTime,
  normalizeItems,
  safeVehiculoVisitaKey,
  sxCard,
  sxInfoBtn,
  sxInput,
  sxPrimaryBtn,
  sxSectionBar,
  sxSuccessBtn,
} from "./utils/accesos.helpers.js";

import {
  exportarRegistrosCsv,
  exportarRegistrosPdf,
} from "./utils/accesos.export.js";

import Avatar from "./components/Avatar.jsx";
import EnEmpresaSwitch from "./components/EnEmpresaSwitch.jsx";
import NuevoEmpleadoModal from "./components/NuevoEmpleadoModal.jsx";
import EditarEmpleadoModal from "./components/EditarEmpleadoModal.jsx";
import NuevoVehiculoModal from "./components/NuevoVehiculoModal.jsx";
import NuevoMovimientoModal from "./components/NuevoMovimientoModal.jsx";
import ObservacionMovimientoModal from "./components/ObservacionMovimientoModal.jsx";

const MOVIMIENTOS_STORAGE_KEY = "movimientosManual";

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMovimientoLocal(r) {
  const copy = { ...r };

  if (!copy.fechaIso && copy.fechaHora) {
    try {
      const parts = String(copy.fechaHora).split(" ");
      if (parts[0]) {
        const [dd, mm, yyyy] = parts[0].split("/");
        if (dd && mm && yyyy) copy.fechaIso = `${yyyy}-${mm}-${dd}`;
      }
    } catch {
      // ignore
    }
  }

  return {
    fechaHora: copy.fechaHora || "",
    fechaFin: copy.fechaFin || "",
    noRegresa: !!copy.noRegresa,
    tipo: copy.tipo || "",
    persona: copy.persona || "",
    personaId: copy.personaId || "",
    placa: copy.placa || "",
    observacion: copy.observacion || "",
    departamento: copy.departamento || "",
    fechaIso: copy.fechaIso || "",
  };
}

function sortRegistrosByFechaDesc(items = []) {
  return [...items].sort((a, b) => {
    const av = new Date(a?.fechaHora || 0).getTime();
    const bv = new Date(b?.fechaHora || 0).getTime();
    return bv - av;
  });
}

export default function Accesos() {
  const { hasPerm, isSuperAdmin } = useAuth();

  const canReadAccesos =
    isSuperAdmin || hasPerm(PERMS.READ) || hasPerm(PERMS.WRITE);

  const canWriteAccesos = isSuperAdmin || hasPerm(PERMS.WRITE);

  const canExportAccesos = isSuperAdmin || hasPerm(PERMS.EXPORT);

  const canDeleteAccesos =
    isSuperAdmin ||
    hasPerm(PERMS.DELETE) ||
    hasPerm("accesos.delete.any") ||
    hasPerm("accesos.records.delete.any");

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
      const stored = localStorage.getItem(MOVIMIENTOS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return toSafeArray(parsed).map(normalizeMovimientoLocal);
    } catch {
      return [];
    }
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

      setCatalogos(next);
    } catch (e) {
      console.warn("[Accesos] error general cargando catálogos:", e);
    }
  }

  function persistRegistrosLocal(nextRegistros) {
    try {
      localStorage.setItem(
        MOVIMIENTOS_STORAGE_KEY,
        JSON.stringify(nextRegistros.map(normalizeMovimientoLocal))
      );
    } catch {
      // ignore
    }
  }

  async function handleGuardarObs() {
    if (!canWriteAccesos) {
      alert("No tienes permiso para registrar movimientos.");
      return;
    }

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

  async function agregarRegistro(registro) {
    if (!canWriteAccesos) {
      alert("No tienes permiso para registrar movimientos.");
      return;
    }

    const normalized = normalizeMovimientoLocal(registro);

    try {
      await crearRegistroManual(normalized);
    } catch (e) {
      alert(e.message || "No se pudo registrar el movimiento manual.");
      return;
    }

    setRegistros((prev) => {
      const next = sortRegistrosByFechaDesc([normalized, ...prev]);
      persistRegistrosLocal(next);
      return next;
    });
  }

  async function fetchRegistrosManual() {
    try {
      const { data } = await api.get("/acceso/movimientos-manual");
      const items = toSafeArray(data?.items);

      if (items.length) {
        const convertidos = items.map((item) => {
          const fecha = item.fechaHora ? new Date(item.fechaHora) : null;
          const fechaValida = fecha && !Number.isNaN(fecha.getTime());

          const fechaFin = item.fechaFin ? new Date(item.fechaFin) : null;
          const fechaFinValida = fechaFin && !Number.isNaN(fechaFin.getTime());

          return normalizeMovimientoLocal({
            fechaHora: fechaValida ? formatDateTime(fecha) : "",
            fechaFin: fechaFinValida ? formatDateTime(fechaFin) : "",
            noRegresa: !!item.noRegresa,
            tipo: item.tipo || "",
            persona: item.persona || "",
            personaId: item.personaId || "",
            placa: item.placa || "",
            observacion: item.observacion || "",
            departamento: item.departamento || "",
            fechaIso: fechaValida ? item.fechaHora.slice(0, 10) : "",
          });
        });

        const sorted = sortRegistrosByFechaDesc(convertidos);
        setRegistros(sorted);
        persistRegistrosLocal(sorted);
        return;
      }

      const stored = localStorage.getItem(MOVIMIENTOS_STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        setRegistros(sortRegistrosByFechaDesc(toSafeArray(arr).map(normalizeMovimientoLocal)));
      } else {
        setRegistros([]);
      }
    } catch (error) {
      console.error("Error al cargar movimientos manuales", error);

      try {
        const stored = localStorage.getItem(MOVIMIENTOS_STORAGE_KEY);
        if (stored) {
          const arr = JSON.parse(stored);
          setRegistros(sortRegistrosByFechaDesc(toSafeArray(arr).map(normalizeMovimientoLocal)));
          return;
        }
      } catch {
        // ignore
      }

      setRegistros([]);
    }
  }

  async function crearRegistroManual(registro) {
    if (!canWriteAccesos) {
      throw new Error("No tienes permiso para registrar movimientos manuales");
    }

    let fechaHoraISO = null;
    if (registro.fechaIso && registro.fechaHora) {
      const horaPart = String(registro.fechaHora).split(" ")[1] || "00:00";
      fechaHoraISO = new Date(
        `${registro.fechaIso}T${horaPart}:00`
      ).toISOString();
    }

    const fechaFinISO = registro.noRegresa
      ? null
      : registro.fechaFin && registro.fechaIso
      ? new Date(
          `${registro.fechaIso}T${
            String(registro.fechaFin).split(" ")[1] || "00:00"
          }:00`
        ).toISOString()
      : null;

    const body = {
      fechaHora: fechaHoraISO,
      fechaFin: fechaFinISO,
      noRegresa: !!registro.noRegresa,
      tipo: registro.tipo,
      personaId: registro.personaId || null,
      persona: registro.persona || null,
      placa: registro.placa || null,
      observacion: registro.observacion || null,
      departamento: registro.departamento || null,
    };

    await api.post("/acceso/movimientos-manual", body);
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;

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
    return filtered.slice(0, 5);
  }, [filtered, showAllAccesos]);

  async function fetchItems() {
    try {
      setLoading(true);
      setErr("");

      let items = [];

      try {
        const { data } = await api.get("/acceso/empleados-vehiculos");
        items = toSafeArray(data?.items);
      } catch {
        const { data } = await api.get("/acceso/empleados");
        items = toSafeArray(data?.items);
      }

      setRows(normalizeItems(items));
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

      const { data } = await api.get("/visitas/vehiculos-en-sitio");
      const items = toSafeArray(data?.items);

      setVehiculosVisitas(items);
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

    setRows((prev) =>
      prev.map((r) =>
        r._id === row._id
          ? {
              ...r,
              vehiculo: r.vehiculo
                ? { ...r.vehiculo, enEmpresa: nextValue }
                : r.vehiculo,
            }
          : r
      )
    );

    try {
      await api.patch(`/acceso/vehiculos/${row.vehiculo._id}/en-empresa`, {
        enEmpresa: nextValue,
      });
    } catch (e) {
      console.error(e);

      setRows((prev) =>
        prev.map((r) =>
          r._id === row._id
            ? {
                ...r,
                vehiculo: r.vehiculo
                  ? { ...r.vehiculo, enEmpresa: !nextValue }
                  : r.vehiculo,
              }
            : r
        )
      );

      alert(e.message || "Error actualizando vehículo");
    }
  }

  async function handleDeleteEmpleado(empleado) {
    if (!canDeleteAccesos) {
      alert("No tienes permiso para eliminar empleados.");
      return;
    }

    if (!empleado?._id) return;

    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar a “${
        empleado.nombreCompleto || "este empleado"
      }”? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/acceso/empleados/${empleado._id}`);
      await fetchItems();
    } catch (error) {
      alert(error.message || "Error al eliminar el empleado");
    }
  }

  async function registrarMovimientoRapido(tipo, fila) {
    if (!canWriteAccesos) {
      alert("No tienes permiso para registrar movimientos.");
      return;
    }

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
    if (!canReadAccesos) {
      setLoading(false);
      setLoadingVehVis(false);
      return;
    }

    fetchItems();
    fetchVehiculosVisitas();
    fetchRegistrosManual();
    fetchCatalogos();
  }, [canReadAccesos]);

  const empleadosList = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const e = r.empleado;
      if (e && e._id && !map.has(e._id)) map.set(e._id, e);
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a?.nombreCompleto || "").localeCompare(String(b?.nombreCompleto || ""))
    );
  }, [rows]);

  const deptosDisponibles = useMemo(() => {
    const set = new Set();
    empleadosList.forEach((e) => {
      if (e?.departamento) set.add(e.departamento);
    });
    const base = Array.from(set).sort();
    const fromCatalog = catalogos.departamentos || [];
    return Array.from(new Set([...base, ...fromCatalog])).sort();
  }, [empleadosList, catalogos.departamentos]);

  const registrosFiltrados = useMemo(() => {
    const filteredItems = registros.filter((r) => {
      if (filterEmpleado && r.personaId !== filterEmpleado) return false;
      if (filterDepto && r.departamento !== filterDepto) return false;

      const fecha = r.fechaIso || "";
      if (filterDesde && fecha < filterDesde) return false;
      if (filterHasta && fecha > filterHasta) return false;

      return true;
    });

    return sortRegistrosByFechaDesc(filteredItems);
  }, [registros, filterEmpleado, filterDepto, filterDesde, filterHasta]);

  const registrosEntradas = useMemo(() => {
    return registrosFiltrados.filter((r) => {
      const tipo = String(r.tipo || "").toLowerCase();
      return tipo === "entrada" || tipo === "salida";
    });
  }, [registrosFiltrados]);

  const registrosPermisos = useMemo(() => {
    return registrosFiltrados.filter((r) => {
      const tipo = String(r.tipo || "").toLowerCase();
      return tipo === "permiso";
    });
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

  if (!canReadAccesos) {
    return (
      <div className={UI.page}>
        <div className={UI.cardSoft} style={sxCard()}>
          <div className="px-4 py-10 text-center">
            <h1 className={UI.title} style={{ color: "var(--text)" }}>
              Control de Acceso
            </h1>
            <p
              className="mt-3 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No tienes permisos para ver este módulo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function handleExportCsv() {
    if (!canExportAccesos) {
      alert("No tienes permiso para exportar registros.");
      return;
    }
    exportarRegistrosCsv(registrosFiltrados);
  }

  function handleExportPdf() {
    if (!canExportAccesos) {
      alert("No tienes permiso para exportar registros.");
      return;
    }
    exportarRegistrosPdf(registrosFiltrados);
  }

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
          {canWriteAccesos && (
            <button
              type="button"
              className={`flex-1 sm:flex-none ${UI.btnInfo}`}
              style={sxInfoBtn()}
              onClick={() => setShowNewEmp(true)}
            >
              <span className="text-lg sm:text-xl leading-none">＋</span> Nuevo
              Empleado
            </button>
          )}

          {canWriteAccesos && (
            <button
              type="button"
              className={`flex-1 sm:flex-none ${UI.btnSuccess}`}
              style={sxSuccessBtn()}
              onClick={() => setShowNewVeh(true)}
            >
              <span className="text-lg sm:text-xl leading-none">＋</span> Nuevo
              Vehículo
            </button>
          )}
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
                ? "Ver solo primeros 5 registros"
                : "Ver todos los registros"}
            </button>
          )}
        </div>

        <div className={UI.tableWrap}>
          <table className={UI.table}>
            <thead className={UI.thead} style={sxSectionBar()}>
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
                        disabled={!row?.vehiculo?._id || !canWriteAccesos}
                        onChange={(val) => handleToggleEnEmpresa(row, val)}
                      />
                    </td>

                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-2 items-center">
                        {canWriteAccesos && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        {canWriteAccesos && (
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
                        )}

                        {canDeleteAccesos && (
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
                        )}

                        <div className="flex sm:hidden w-full justify-start gap-1 mt-1">
                          {canWriteAccesos && (
                            <>
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
                            </>
                          )}
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
                      {`${v.vehiculoMarca || ""} ${v.vehiculoModelo || ""}`.trim() || "—"}
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

            {canWriteAccesos && (
              <button
                type="button"
                className={UI.btnSuccess}
                style={sxSuccessBtn()}
                onClick={() => setShowNuevoMov(true)}
              >
                <span className="text-lg leading-none">＋</span> Registrar permiso
              </button>
            )}

            {canExportAccesos && (
              <button
                type="button"
                className={UI.btnInfo}
                style={sxInfoBtn()}
                onClick={handleExportCsv}
              >
                <span className="text-lg leading-none">⇩</span> Exportar CSV
              </button>
            )}

            {canExportAccesos && (
              <button
                type="button"
                className={UI.btnPrimary}
                style={sxPrimaryBtn()}
                onClick={handleExportPdf}
              >
                <span className="text-lg leading-none">🖨</span> Exportar PDF
              </button>
            )}
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
                <tr key={`${r.fechaHora}-${r.persona}-${idx}`} style={{ borderTop: "1px solid var(--border)" }}>
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
                <tr key={`${r.fechaHora}-${r.persona}-${idx}`} style={{ borderTop: "1px solid var(--border)" }}>
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

      {canWriteAccesos && (
        <NuevoEmpleadoModal
          open={showNewEmp}
          onClose={() => setShowNewEmp(false)}
          onCreated={fetchItems}
          sexos={catalogos.sexos}
          estados={catalogos.estados}
          departamentos={catalogos.departamentos}
          cargos={catalogos.cargos}
        />
      )}

      {canWriteAccesos && (
        <EditarEmpleadoModal
          empleado={editEmpleado}
          onClose={() => setEditEmpleado(null)}
          onSaved={fetchItems}
          sexos={catalogos.sexos}
          estados={catalogos.estados}
          departamentos={catalogos.departamentos}
          cargos={catalogos.cargos}
        />
      )}

      {canWriteAccesos && (
        <NuevoVehiculoModal
          open={showNewVeh}
          onClose={() => setShowNewVeh(false)}
          onCreated={fetchItems}
          empleados={empleadosList}
          marcasVehiculos={catalogos.marcasVehiculos}
        />
      )}

      {canWriteAccesos && (
        <NuevoMovimientoModal
          open={showNuevoMov}
          onClose={() => setShowNuevoMov(false)}
          onCreated={agregarRegistro}
          empleados={empleadosList}
        />
      )}

      {showObsModal && canWriteAccesos && (
        <ObservacionMovimientoModal
          open={showObsModal}
          obsTipo={obsTipo}
          obsFila={obsFila}
          obsValue={obsValue}
          setObsValue={setObsValue}
          onClose={() => {
            setShowObsModal(false);
            setObsFila(null);
            setObsTipo("");
            setObsValue("");
          }}
          onSave={handleGuardarObs}
        />
      )}
    </div>
  );
}