// client/src/pages/Accesos/Accesos.jsx
import { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api";

/* Normaliza empleados + vehículos desde tu API */
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
      // Para editar
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
        _id: `${e._id}-${
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

/* ---------- Página ---------- */
export default function Accesos() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showNewEmp, setShowNewEmp] = useState(false);
  const [editEmp, setEditEmp] = useState(null); // objeto empleado o null
  const [showNewVeh, setShowNewVeh] = useState(false);

  // 🔹 NUEVO: estado para vehículos de VISITAS
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
      // Preferimos esta ruta; si no existe, usa fallback
      let res = await fetch(`${API_BASE}/acceso/empleados-vehiculos`, {
        credentials: "include",
      });
      let data = await res.json().catch(() => ({}));
      // Fallback a /acceso/empleados si la otra no existe
      if (!res.ok || data?.ok === false || !Array.isArray(data?.items)) {
        res = await fetch(`${API_BASE}/acceso/empleados`, {
          credentials: "include",
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false)
          throw new Error(data?.error || "Error de API");
      }
      setRows(normalizeItems(data.items));
    } catch (e) {
      console.error(e);
      setErr(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // 🔹 NUEVO: obtener vehículos de visitantes en el estacionamiento
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

  // Toggle En Empresa (vehículo)
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
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(
          data?.error || "No se pudo actualizar el estado del vehículo"
        );
      await fetchItems();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  // Toggle ACTIVO/INACTIVO (empleado)
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
        res = await fetch(`${API_BASE}/acceso/empleados/${empId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ activo: nextValue }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false)
        throw new Error(
          data?.error || "No se pudo actualizar el estado del empleado"
        );
      await fetchItems();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  useEffect(() => {
    fetchItems();
    fetchVehiculosVisitas(); // 🔹 cargamos también los vehículos de visitantes
  }, []);

  // Única lista de empleados (para selects)
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

      {/* Tabla: PERSONAL Y VEHÍCULOS DE EMPLEADOS (tal como la tenías) */}
      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-300 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Foto</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">ID Persona</th>
                <th className="px-4 py-3 font-medium">Depto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Vehículo</th>
                <th className="px-4 py-3 font-medium">No. Placa</th>
                <th className="px-4 py-3 font-medium">En Empresa</th>
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

              {!loading && !err && filtered.length === 0 && (
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
                filtered.map((row) => (
                  <tr key={row._id}>
                    <td className="px-4 py-3">
                      <Avatar
                        url={row?.empleado?.fotoUrl}
                        name={row?.empleado?.nombreCompleto}
                      />
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

                    {/* ESTADO (empleado) con confirmación al desactivar */}
                    <td className="px-4 py-3">
                      <EstadoSwitch
                        value={!!row?.empleado?.activo}
                        onChange={(nextVal) => {
                          if (nextVal === false) {
                            const ok = window.confirm(
                              `¿Deseas marcar como INACTIVO a “${
                                row?.empleado?.nombreCompleto || "este empleado"
                              }”?`
                            );
                            if (!ok) return;
                          }
                          // UI optimista
                          setRows((prev) =>
                            prev.map((r) =>
                              r.empleado._id === row.empleado._id
                                ? {
                                    ...r,
                                    empleado: {
                                      ...r.empleado,
                                      activo: nextVal,
                                    },
                                  }
                                : r
                            )
                          );
                          handleToggleActivo(row, nextVal);
                        }}
                      />
                    </td>

                    <td className="px-4 py-3">
                      {row?.vehiculo?.modelo || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row?.vehiculo?.placa || "—"}
                    </td>

                    {/* En Empresa (vehículo) */}
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
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
                          onClick={() => setEditEmp(row.empleado)}
                        >
                          Editar
                        </button>
                        {/* Botón Desactivar eliminado */}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-gray-400">
          Consejo: con “Estado” controlas si el empleado está{" "}
          <b>Activo/Inactivo</b>. “En Empresa” indica si su vehículo está dentro
          del estacionamiento.
        </div>
      </div>

      {/* 🔹 SECCIÓN (SIN MODIFICAR) – Vehículos de visitantes en el estacionamiento */}
      <section className="mt-6 rounded-2xl bg-slate-900/70 border border-slate-700/60 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Vehículos de visitantes en el estacionamiento
            </h2>
            <p className="text-xs text-slate-400">
              Información tomada del módulo de Visitas (solo visitas con estado
              &quot;Dentro&quot; y que llegaron en vehículo).
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {vehiculosVisitas.length} vehículos
          </span>
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
                vehiculosVisitas.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-100">
                      {v.visitante}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {v.documento || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {v.empresa || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {v.empleadoAnfitrion || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 uppercase">
                      {`${v.vehiculoMarca || ""} ${
                        v.vehiculoModelo || ""
                      }`.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 uppercase">
                      {v.placa || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {v.horaEntrada
                        ? new Date(v.horaEntrada).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}

              {!loadingVehVis &&
                !errVehVis &&
                vehiculosVisitas.length === 0 && (
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

      {/* Modales */}
      <NuevoEmpleadoModal
        open={showNewEmp}
        onClose={() => setShowNewEmp(false)}
        onCreated={fetchItems}
      />

      <EditarEmpleadoModal
        empleado={editEmp}
        onClose={() => setEditEmp(null)}
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

/* ---------- Helpers UI ---------- */
function Avatar({ url, name }) {
  if (url)
    return (
      <img
        src={url}
        alt={name || "avatar"}
        className="h-9 w-9 rounded-full object-cover"
      />
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition
        ${
          ok
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-rose-500/15 text-rose-300"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
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
    <Pill
      ok={!!value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      okText="Sí"
      noText="No"
    />
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

/* ---------------- Modal: Nuevo Empleado ---------------- */

const SEXOS = ["Femenino", "Masculino", "Otro"];
const ESTADOS = ["Activo", "Inactivo"];
const DEPTOS_SUGERIDOS = [
  "Ingeniería",
  "Ventas",
  "Administración",
  "Logística",
  "Seguridad",
];

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
      setForm(INITIAL); // limpiar cada vez que abre
      setError("");
    }
  }, [open]);

  if (!open) return null;
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

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

      const data = await res.json();
      if (!res.ok || !data?.ok)
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
          <h2 className="text-lg font-semibold text-white">
            Registrar Nuevo Empleado
          </h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error ? (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-sm">
              {error}
            </div>
          ) : null}

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
              />
            </Field>

            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
              />
            </Field>

            <Field label="Sexo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.telefono}
                onChange={(e) => setVal("telefono", e.target.value)}
              />
            </Field>

            <Field label="Dirección" span={2}>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
              />
            </Field>

            <Field label="Área / Departamento">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
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
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
              />
            </Field>

            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
              />
            </Field>

            <Field label="Estado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
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
              onClick={handleSubmit}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Modal: Editar Empleado ---------------- */
function EditarEmpleadoModal({ empleado, onClose, onSaved }) {
  const open = !!empleado;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (empleado) {
      setForm({
        nombreCompleto: empleado.nombreCompleto || "",
        id_persona: empleado.id_persona || "",
        dni: empleado.dni || "",
        fechaNacimiento: empleado.fechaNacimiento || "",
        sexo: empleado.sexo || "",
        direccion: empleado.direccion || "",
        telefono: empleado.telefono || "",
        departamento: empleado.departamento || "",
        cargo: empleado.cargo || "",
        fechaIngreso: empleado.fechaIngreso || "",
        estado: empleado.activo ? "Activo" : "Inactivo",
      });
      setError("");
    }
  }, [empleado]);

  if (!open || !form) return null;
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Editar Empleado</h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {error ? (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-sm">
              {error}
            </div>
          ) : null}

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
              />
            </Field>

            <Field label="Fecha de Nacimiento">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
              />
            </Field>

            <Field label="Sexo">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.telefono}
                onChange={(e) => setVal("telefono", e.target.value)}
              />
            </Field>

            <Field label="Dirección" span={2}>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
              />
            </Field>

            <Field label="Área / Departamento">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
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
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
              />
            </Field>

            <Field label="Fecha de Ingreso">
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
              />
            </Field>

            <Field label="Estado">
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
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
              onClick={handleSave}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Modal: Nuevo Vehículo ---------------- */
function NuevoVehiculoModal({ open, onClose, onCreated, empleados }) {
  const INITIAL = {
    empleadoId: "",
    modelo: "",
    placa: "",
    enEmpresa: false,
  };
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    setError("");

    try {
      const body = {
        empleado: form.empleadoId,
        modelo: form.modelo.trim(),
        placa: form.placa.trim().toUpperCase(),
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
          <h2 className="text-lg font-semibold text-white">
            Registrar Nuevo Vehículo
          </h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error ? (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-red-200 text-sm">
              {error}
            </div>
          ) : null}

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
                    {e.nombreCompleto}{" "}
                    {e.id_persona ? `(${e.id_persona})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modelo">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.modelo}
                onChange={(e) => setVal("modelo", e.target.value)}
                required
              />
            </Field>

            <Field label="Placa">
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                value={form.placa}
                onChange={(e) => setVal("placa", e.target.value)}
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
                className="text-sm text-slate-200"
              >
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
              onClick={handleSubmit}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Campo helper ---------- */
function Field({ label, children, span = 1 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? "md:col-span-2" : ""}`}>
      <label className="text-sm text-slate-300">{label}</label>
      {children}
    </div>
  );
}
