import { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api";



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

  async function fetchItems() {
    try {
      setLoading(true);
      setErr("");
      // Preferimos la ruta /acceso/empleados-vehiculos; si falla, usamos /acceso/empleados
      let res = await fetch(`${API_BASE}/acceso/empleados-vehiculos`, {
        credentials: "include",
      });
      let data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false || !Array.isArray(data?.items)) {
        // fallback a /acceso/empleados
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

  async function handleToggleActivo(row, nextValue) {
    const empId = row?.empleado?._id;
    if (!empId) return;
    try {
      let res = await fetch(`${API_BASE}/acceso/empleados/${empId}/activo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ activo: nextValue }),
      });
      if (res.status === 404) {
        // fallback si la ruta /activo no existe
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
          data?.error || "No se pudo actualizar el estado del empleado"
        );
      }
      await fetchItems();
    } catch (e) {
      console.error(e);
      alert(e.message || "Error actualizando empleado");
    }
  }

  // Eliminar empleado con confirmación
  async function handleDeleteEmpleado(empleado) {
    if (!empleado?._id) return;
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar a “${empleado.nombreCompleto || "este empleado"}"? Esta acción no se puede deshacer.`
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
      // Actualizar la lista de empleados tras la eliminación
      await fetchItems();
    } catch (error) {
      alert(error.message || "Error al eliminar el empleado");
    }
  }

  useEffect(() => {
    fetchItems();
    fetchVehiculosVisitas();
  }, []);

  const empleadosList = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const e = r.empleado;
      if (e && !map.has(e._id)) map.set(e._id, e);
    });
    return Array.from(map.values());
  }, [rows]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Control de Acceso
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Registro de personal y vehículos.
        </p>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 transition"
            onClick={() => setShowNewEmp(true)}
          >
            <span className="text-xl leading-none">＋</span> Nuevo Empleado
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 transition"
            onClick={() => setShowNewVeh(true)}
          >
            <span className="text-xl leading-none">＋</span> Nuevo Vehículo
          </button>
        </div>

        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, id persona, depto, placa…"
            className="w-80 rounded-xl bg-black/20 border border-white/10 px-4 py-2 text-sm outline-none focus:border-sky-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            Ctrl/⌘+K
          </span>
        </div>
      </div>

      {/* Tabla: PERSONAL Y VEHÍCULOS DE EMPLEADOS */}
      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-300 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Foto</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">ID Persona</th>
                <th className="px-4 py-3 font-medium">Depto</th>
                {/* Eliminamos la columna de Estado para simplificar la interfaz */}
                <th className="px-4 py-3 font-medium">Vehículo</th>
                <th className="px-4 py-3 font-medium">No. Placa</th>
                <th className="px-4 py-3 font-medium">En Empresa</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {err && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-red-400">
                    Error: {err}
                  </td>
                </tr>
              )}
              {!loading && !err && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Sin resultados.
                  </td>
                </tr>
              )}
              {!loading && !err && filtered.map((row) => (
                <tr key={row._id}>
                  <td className="px-4 py-3">
                    <Avatar url={row?.empleado?.fotoUrl} name={row?.empleado?.nombreCompleto} />
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {row?.empleado?.nombreCompleto || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row?.empleado?.id_persona || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row?.empleado?.departamento || "—"}
                  </td>
                  {/* Se omite la celda de Estado */}
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      {/* Botón para editar el empleado */}
                      <button
                        title="Editar empleado"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
                        onClick={() => setEditEmpleado(row.empleado)}
                      >
                        {/* Icono de lápiz (diseño cuadrado neon) */}
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
                            {/* cuerpo del lápiz */}
                            <path d="M18 46 L46 18" />
                            {/* punta del lápiz */}
                            <polyline points="46 18 50 22 22 50 18 46" />
                            {/* línea de la punta */}
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
                        {/* Icono de papelera (diseño cuadrado neon) */}
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
                            {/* tapa */}
                            <polyline points="20 22 44 22" />
                            <polyline points="24 22 26 16 38 16 40 22" />
                            {/* cuerpo */}
                            <rect x="20" y="22" width="24" height="26" rx="4" />
                            {/* líneas verticales */}
                            <line x1="26" y1="28" x2="26" y2="44" />
                            <line x1="32" y1="28" x2="32" y2="44" />
                            <line x1="38" y1="28" x2="38" y2="44" />
                          </g>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-gray-400">
          Consejo: “En Empresa” indica si el vehículo del empleado está dentro del
          estacionamiento. Haz clic en la flecha para actualizar su estado.
        </div>
      </div>

      {/* Vehículos de visitantes en el estacionamiento */}
      <section className="mt-6 rounded-2xl bg-slate-900/70 border border-slate-700/60 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Vehículos de visitantes en el estacionamiento
            </h2>
            <p className="text-xs text-slate-400">
              Información tomada del módulo de Visitas (solo visitas con estado “Dentro” y que llegaron en vehículo).
            </p>
          </div>
          <span className="text-xs text-slate-400">{vehiculosVisitas.length} vehículos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Visitante</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Empleado anfitrión</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">No. Placa</th>
                <th className="px-4 py-3">Hora entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loadingVehVis && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    Cargando vehículos de visitantes…
                  </td>
                </tr>
              )}
              {errVehVis && !loadingVehVis && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-rose-300">
                    Error: {errVehVis}
                  </td>
                </tr>
              )}
              {!loadingVehVis && !errVehVis && vehiculosVisitas.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-slate-100">{v.visitante}</td>
                  <td className="px-4 py-3 text-slate-300">{v.documento || "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{v.empresa || "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{v.empleadoAnfitrion || "—"}</td>
                  <td className="px-4 py-3 text-slate-300 uppercase">
                    {`${v.vehiculoMarca || ""} ${v.vehiculoModelo || ""}`.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 uppercase">{v.placa || "—"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {v.horaEntrada ? new Date(v.horaEntrada).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {!loadingVehVis && !errVehVis && vehiculosVisitas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    No hay vehículos de visitantes dentro de la empresa en este momento.
                  </td>
                </tr>
              )}
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
    </div>
  );
}

// Helpers UI
function Avatar({ url, name }) {
  if (url)
    return (
      <img src={url} alt={name || "avatar"} className="h-9 w-9 rounded-full object-cover" />
    );
  const initials = (name || "—")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-white/10 grid place-items-center text-xs font-semibold">
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
      {ok ? okText : noText}
    </button>
  );
}

function EnEmpresaSwitch({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2">
      {/* Indicador de sí/no */}
      <Pill
        ok={!!value}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        okText="Sí"
        noText="No"
      />
      {/* Flecha animada para indicar que se puede cambiar */}
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
        {/* Icono de flecha (diseño cuadrado neon) */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 animate-bounce"
        >
          <rect width="64" height="64" fill="#0A0F24" />
          <g
            stroke="#2DC4B6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            {/* flecha hacia arriba */}
            <polyline points="20 36 32 24 44 36" />
            {/* flecha hacia abajo */}
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

// Lista de marcas sugeridas para vehículos. Ajusta según las marcas que maneje tu organización.
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

// Tabla de modelos disponibles por marca. Ajusta según las marcas y modelos de tu flota.
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
  // Validar nombre: obligatorio y al menos 8 letras (se ignoran espacios); solo letras y espacios permitidos
  if (!form.nombreCompleto.trim()) {
    errors.push("El nombre completo es obligatorio.");
  } else {
    // Contar solo letras (incluyendo acentos y ñ/Ñ)
    const letters = form.nombreCompleto.replace(/[^A-Za-zÁÉÍÓÚáéíóúÜüñÑ]/g, "");
    if (letters.length < 8) {
      errors.push("El nombre completo debe tener al menos 8 letras.");
    }
    // Validar que solo contenga letras y espacios
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(form.nombreCompleto.trim())) {
      errors.push("El nombre completo solo debe contener letras y espacios.");
    }
  }
  // Validar ID Persona: obligatorio y solo números
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

  // Validar sexo: obligatorio
  if (!form.sexo || !form.sexo.trim()) {
    errors.push("El sexo es obligatorio.");
  }
  // Validar DNI: obligatorio y con formato dddd-dddd-ddddd o dddd_dddd_ddddd
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
  // Validar teléfono: obligatorio y formato dddd-dddd o dddd_dddd
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

  // Validar dirección: obligatoria y solo letras y espacios
  if (!form.direccion || !form.direccion.trim()) {
    errors.push("La dirección es obligatoria.");
  } else {
    const direccionTrim = form.direccion.trim();
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(direccionTrim)) {
      errors.push("La dirección solo debe contener letras y espacios.");
    }
  }
  // Validar fecha de nacimiento: obligatoria y no futura
  if (!form.fechaNacimiento) {
    errors.push("La fecha de nacimiento es obligatoria.");
  } else if (form.fechaNacimiento > today) {
    errors.push("La fecha de nacimiento no puede ser futura.");
  }
  // Validar fecha de ingreso: obligatoria y no futura
  if (!form.fechaIngreso) {
    errors.push("La fecha de ingreso es obligatoria.");
  } else if (form.fechaIngreso > today) {
    errors.push("La fecha de ingreso no puede ser futura.");
  }
  // Comparar fechas: ingreso no puede ser anterior al nacimiento
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Registrar Nuevo Empleado</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre Completo">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.nombreCompleto}
                onChange={(e) => setVal("nombreCompleto", e.target.value)}
                required
              />
            </Field>
            <Field label="ID Persona">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>
            <Field label="DNI">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.dni}
                onChange={(e) => setVal("dni", e.target.value)}
                required
              />
            </Field>
            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
                required
              />
            </Field>
            <Field label="Sexo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.telefono}
                onChange={(e) => setVal("telefono", e.target.value)}
                required
              />
            </Field>
            <Field label="Dirección" span={2}>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>
            <Field label="Área / Departamento">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {DEPTOS_SUGERIDOS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Cargo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {CARGOS_SUGERIDOS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
                required
              />
            </Field>
            <Field label="Estado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50"
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
  // Construir un formulario inicial basado en el empleado recibido. Si no hay empleado (modal cerrada), se usan valores vacíos.
  const initialForm = useMemo(
    () => ({
      nombreCompleto: empleado?.nombreCompleto || "",
      id_persona: empleado?.id_persona || "",
      dni: empleado?.dni || "",
      // Convierte la fecha de nacimiento a formato YYYY-MM-DD para que el input <input type="date"> pueda mostrarlo.
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
      // Igual para la fecha de ingreso.
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
  // Cuando cambia el empleado (se abre el modal con otro empleado), actualiza el formulario.
  useEffect(() => {
    setForm(initialForm);
    setError("");
  }, [initialForm]);
  // Siempre declaramos los hooks antes de cualquier retorno condicional.
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const cargosOptions = useMemo(() => {
    // Si el cargo actual ya está en la lista sugerida o está vacío, devolvemos las sugerencias.
    if (!form.cargo || CARGOS_SUGERIDOS.includes(form.cargo)) {
      return CARGOS_SUGERIDOS;
    }
    // De lo contrario, colocamos el cargo actual al principio para no perderlo.
    return [form.cargo, ...CARGOS_SUGERIDOS];
  }, [form.cargo]);
  // Si no hay empleado seleccionado, no se muestra el modal.
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
      if (!res.ok || data?.ok === false)
        throw new Error(data?.error || "No se pudo actualizar el empleado");
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Editar Empleado</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre Completo">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.nombreCompleto}
                onChange={(e) => setVal("nombreCompleto", e.target.value)}
                required
              />
            </Field>
            <Field label="ID Persona">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>
            <Field label="DNI">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.dni}
                onChange={(e) => setVal("dni", e.target.value)}
                required
              />
            </Field>
            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
                required
              />
            </Field>
            <Field label="Sexo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.telefono}
                onChange={(e) => setVal("telefono", e.target.value)}
                required
              />
            </Field>
            <Field label="Dirección" span={2}>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>
            <Field label="Área / Departamento">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {DEPTOS_SUGERIDOS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Cargo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {cargosOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
                required
              />
            </Field>
            <Field label="Estado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50"
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
  // Calcular los modelos disponibles en función de la marca seleccionada.
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
      // Validar todos los campos: empleado, marca, modelo y placa son obligatorios
      if (!form.empleadoId || !form.marca || !form.modelo || !form.placa.trim()) {
        setError("Todos los campos son obligatorios.");
        setSaving(false);
        return;
      }
      // Validar que la placa tenga exactamente 7 caracteres alfanuméricos
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
      if (!res.ok || data?.ok === false)
        throw new Error(data?.error || "No se pudo crear el vehículo");
      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Registrar Nuevo Vehículo</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <Field label="Empleado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
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

            {/* Seleccionar marca del vehículo */}
            <Field label="Marca">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.marca}
                onChange={(e) => {
                  const value = e.target.value;
                  // Al cambiar la marca, reiniciamos el modelo para que el usuario elija uno válido
                  setForm((s) => ({ ...s, marca: value, modelo: "" }));
                }}
                required
              >
                <option value="">- Seleccionar -</option>
                {MARCAS_SUGERIDAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>

            {/* Seleccionar modelo del vehículo (depende de la marca) */}
            <Field label="Modelo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.modelo}
                onChange={(e) => setVal("modelo", e.target.value)}
                required
                disabled={!form.marca || modelosDisponibles.length === 0}
              >
                <option value="">- Seleccionar -</option>
                {modelosDisponibles.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Placa">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
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
              <label htmlFor="enEmpresaChk" className="text-sm text-slate-200">
                En Empresa
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
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

function Field({ label, children, span = 1 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? "md:col-span-2" : ""}`}> 
      <label className="text-sm text-slate-300">{label}</label>
      {children}
    </div>
  );
}