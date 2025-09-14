// client/src/pages/Supervision/Supervision.jsx
import React from "react";
import { api } from "../../lib/api.js";
import { useCrud } from "../../lib/useCrud.js";

const fmt = (v) =>
  v ? new Date(v).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const yyyymm = () => new Date().toISOString().slice(0, 7);

/** Etiqueta de estado */
const Pill = ({ estado }) => {
  // compatibilidad con nombres antiguos
  const norm =
    estado === "abierta" ? "abierto" : estado === "cerrada" ? "cerrado" : estado || "abierto";

  const mapCls = {
    abierto: "bg-blue-500/15 text-blue-300",
    en_proceso: "bg-amber-500/15 text-amber-300",
    cerrado: "bg-emerald-500/15 text-emerald-300",
  };
  const mapLbl = {
    abierto: "Abierto",
    en_proceso: "En proceso",
    cerrado: "Cerrado",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${mapCls[norm] || "bg-neutral-600/20"}`}>
      {mapLbl[norm] || "—"}
    </span>
  );
};

export default function Supervision() {
  const { items, list } = useCrud("supervision");

  // filtros
  const [q, setQ] = React.useState("");
  const [estado, setEstado] = React.useState(""); // filtro (OK)
  const [periodo, setPeriodo] = React.useState(yyyymm());

  // alta rápida
  const [form, setForm] = React.useState({
    guardiaId: "", // opcional: No. empleado
    guardia: "",
    turno: "", // lo enviaremos como area para compatibilidad
    puntaje: 80,
    observaciones: "",
  });
  const [saving, setSaving] = React.useState(false);

  // edición en fila
  const [busyId, setBusyId] = React.useState(null);
  const [edit, setEdit] = React.useState({ id: null, puntaje: 80 });

  const reload = React.useCallback(
    (extra = {}) =>
      list({
        limit: 100,
        q: q || undefined,
        estado: estado || undefined,
        periodo: periodo || undefined,
        ...extra,
      }),
    [list, q, estado, periodo]
  );

  React.useEffect(() => {
    reload();
  }, [reload]);

  // Si tienes un servicio para personas/empleados, intenta resolver el nombre por id (no rompe si no existe)
  const onBlurBuscarGuardia = async () => {
    const id = form.guardiaId?.trim();
    if (!id) return;
    try {
      let r;
      try {
        r = await api.get(`/personas/${encodeURIComponent(id)}`);
      } catch {
        r = await api.get(`/guardias/${encodeURIComponent(id)}`); // opción 2 si tu API usa /guardias
      }
      if (r?.data?.nombre) {
        setForm((f) => ({ ...f, guardia: r.data.nombre }));
      }
    } catch {
      // sin cambios si no existe endpoint
    }
  };

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // Para compatibilidad: el backend espera "area"; usamos el campo "turno" del form
      await api.post("/supervision", {
        guardiaId: form.guardiaId || undefined,
        guardia: form.guardia,
        area: form.turno || "", // compat
        turno: form.turno || undefined, // si tu backend ya lo guarda con este nombre
        puntaje: form.puntaje,
        observaciones: form.observaciones,
      });
      setForm({ guardiaId: "", guardia: "", turno: "", puntaje: 80, observaciones: "" });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  /** Cambiar estado con compatibilidad de rutas */
  async function cambiarEstadoSup(id, nuevo, extra = {}) {
    setBusyId(id);
    try {
      // Si ya tienes un endpoint de estado unificado
      await api.patch(`/supervision/${id}/estado`, { estado: nuevo, ...extra });
    } catch {
      // Fallback a tus rutas existentes
      if (nuevo === "cerrado") {
        if (extra.puntaje != null) {
          await api.patch(`/supervision/${id}`, { puntaje: extra.puntaje });
        }
        await api.patch(`/supervision/${id}/cerrar`);
      } else if (nuevo === "abierto") {
        await api.patch(`/supervision/${id}/reabrir`);
      } else if (nuevo === "en_proceso") {
        await api.patch(`/supervision/${id}`, { estado: "en_proceso" });
      }
    } finally {
      await reload();
      setBusyId(null);
      setEdit({ id: null, puntaje: 80 });
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="card grid gap-3 md:grid-cols-4">
        <input
          className="px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Buscar (guardia, área/turno, obs.)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="px-3 py-2 rounded-lg border border-neutral-700/50"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="abierto">Abiertos</option>
          <option value="en_proceso">En proceso</option>
          <option value="cerrado">Cerrados</option>
        </select>
        <input
          type="month"
          className="px-3 py-2 rounded-lg border border-neutral-700/50"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        />
        <button
          onClick={() => reload()}
          className="px-3 py-2 rounded-lg border border-neutral-700/50 hover:bg-neutral-800"
        >
          Aplicar filtros
        </button>
      </div>

      {/* Alta rápida */}
      <form onSubmit={guardar} className="card max-w-2xl space-y-3">
        <h2 className="font-semibold text-lg">Nueva supervisión</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <input
              className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
              placeholder="ID / No. empleado (opcional)"
              value={form.guardiaId}
              onChange={(e) => setForm({ ...form, guardiaId: e.target.value })}
              onBlur={onBlurBuscarGuardia}
            />
          </div>
          <div>
            <input
              className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
              placeholder="Nombre del guardia"
              value={form.guardia}
              onChange={(e) => setForm({ ...form, guardia: e.target.value })}
              required
            />
          </div>
        </div>

        <input
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Turno (por ej. Noche / Día)"
          value={form.turno}
          onChange={(e) => setForm({ ...form, turno: e.target.value })}
          required
        />

        <input
          type="number"
          min={0}
          max={100}
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Puntaje (0-100)"
          value={form.puntaje}
          onChange={(e) => setForm({ ...form, puntaje: Number(e.target.value) })}
        />
        <textarea
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Observaciones"
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
        />
        <button disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </form>

      {/* Tabla */}
      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-3">Supervisiones</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-neutral-800/60">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Guardia</th>
              <th className="py-2 pr-2">Área / Turno</th>
              <th className="py-2 pr-2">Puntaje</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2">Supervisor</th>
              <th className="py-2 pr-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const estadoNorm =
                s.estado === "abierta" ? "abierto" : s.estado === "cerrada" ? "cerrado" : s.estado;
              return (
                <tr key={s._id} className="border-b border-neutral-800/40">
                  <td className="py-2 pr-2 whitespace-nowrap">{fmt(s.fecha || s.createdAt)}</td>
                  <td className="py-2 pr-2">
                    {s.guardia} {s.guardiaId ? <span className="opacity-60">· ID {s.guardiaId}</span> : null}
                  </td>
                  <td className="py-2 pr-2">{s.turno || s.area || "—"}</td>
                  <td className="py-2 pr-2">
                    {edit.id === s._id ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-20 px-2 py-1 rounded-lg border border-neutral-700/50"
                        value={edit.puntaje}
                        onChange={(e) => setEdit({ ...edit, puntaje: Number(e.target.value) })}
                      />
                    ) : (
                      s.puntaje
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <Pill estado={estadoNorm} />
                  </td>
                  <td className="py-2 pr-2">{s.supervisor?.name || "—"}</td>
                  <td className="py-2 pr-2 flex gap-2 flex-wrap">
                    {estadoNorm === "abierto" && (
                      <button
                        type="button"
                        onClick={() => cambiarEstadoSup(s._id, "en_proceso")}
                        disabled={busyId === s._id}
                        className="px-3 py-1.5 rounded-lg border border-neutral-700/50 hover:bg-neutral-800"
                      >
                        {busyId === s._id ? "…" : "Marcar en proceso"}
                      </button>
                    )}

                    {estadoNorm !== "cerrado" && (
                      edit.id === s._id ? (
                        <button
                          type="button"
                          onClick={() => cambiarEstadoSup(s._id, "cerrado", { puntaje: edit.puntaje })}
                          disabled={busyId === s._id}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white disabled:opacity-50"
                        >
                          {busyId === s._id ? "…" : "Cerrar"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEdit({ id: s._id, puntaje: s.puntaje ?? 80 })}
                          className="px-3 py-1.5 rounded-lg border border-neutral-700/50 hover:bg-neutral-800"
                        >
                          Editar puntaje
                        </button>
                      )
                    )}

                    {estadoNorm === "cerrado" && (
                      <button
                        type="button"
                        onClick={() => cambiarEstadoSup(s._id, "abierto")}
                        disabled={busyId === s._id}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white disabled:opacity-50"
                      >
                        {busyId === s._id ? "…" : "Reabrir"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center opacity-70">
                  Sin supervisiones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Administración de planes */}
      <Planes />
    </div>
  );
}

/* ------------------------- PLANES ------------------------- */
function Planes() {
  const [planes, setPlanes] = React.useState([]);
  const [f, setF] = React.useState({
    guardiaId: "",
    guardia: "",
    area: "", // compat
    turno: "", // si tu backend ya lo soporta
    frecuencia: "diaria",
    diasSemana: [],
    diaMes: 1,
    hora: "09:00",
    inicio: new Date().toISOString().slice(0, 10),
    activo: true,
  });
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await api.get("/supervision/plans");
    setPlanes(r.data || []);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleDow = (d) => {
    const s = new Set(f.diasSemana);
    s.has(d) ? s.delete(d) : s.add(d);
    setF({ ...f, diasSemana: Array.from(s).sort() });
  };

  async function crearPlan(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/supervision/plans", {
        ...f,
        inicio: f.inicio ? new Date(f.inicio) : undefined,
        area: f.turno || f.area, // compat si el backend usa "area"
      });
      setF({
        guardiaId: "",
        guardia: "",
        area: "",
        turno: "",
        frecuencia: "diaria",
        diasSemana: [],
        diaMes: 1,
        hora: "09:00",
        inicio: new Date().toISOString().slice(0, 10),
        activo: true,
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function activar(p, activo) {
    await api.patch(`/supervision/plans/${p._id}`, { activo });
    await load();
  }

  async function borrar(p) {
    if (!confirm("¿Eliminar este plan?")) return;
    await api.delete(`/supervision/plans/${p._id}`);
    await load();
  }

  async function ejecutarHoy() {
    await api.post("/supervision/plans/run");
    await load();
  }

  const DOW = ["D", "L", "M", "X", "J", "V", "S"];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={crearPlan} className="card space-y-3">
        <h3 className="font-semibold">Nuevo plan de supervisión</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
            placeholder="ID / No. empleado (opcional)"
            value={f.guardiaId}
            onChange={(e) => setF({ ...f, guardiaId: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
            placeholder="Nombre del guardia"
            value={f.guardia}
            onChange={(e) => setF({ ...f, guardia: e.target.value })}
            required
          />
        </div>

        <input
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Turno (área/puesto)"
          value={f.turno}
          onChange={(e) => setF({ ...f, turno: e.target.value })}
          required
        />

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">Frecuencia</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
              value={f.frecuencia}
              onChange={(e) => setF({ ...f, frecuencia: e.target.value })}
            >
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs opacity-70 mb-1">Hora</label>
            <input
              type="time"
              className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
              value={f.hora}
              onChange={(e) => setF({ ...f, hora: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs opacity-70 mb-1">Inicio</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
              value={f.inicio}
              onChange={(e) => setF({ ...f, inicio: e.target.value })}
            />
          </div>
        </div>

        {f.frecuencia === "semanal" && (
          <div>
            <div className="text-xs opacity-70 mb-1">Días semana</div>
            <div className="flex gap-2 flex-wrap">
              {DOW.map((lbl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDow(i)}
                  className={`px-2 py-1 rounded-lg border ${
                    f.diasSemana.includes(i)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-neutral-700/50"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}

        {f.frecuencia === "mensual" && (
          <div>
            <label className="block text-xs opacity-70 mb-1">Día del mes</label>
            <input
              type="number"
              min={1}
              max={31}
              className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
              value={f.diaMes}
              onChange={(e) => setF({ ...f, diaMes: Number(e.target.value) })}
            />
          </div>
        )}

        <button disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">
          {loading ? "Creando…" : "Crear plan"}
        </button>
      </form>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Planes</h3>
          <button
            onClick={ejecutarHoy}
            className="px-3 py-1.5 rounded-lg border border-neutral-700/50 hover:bg-neutral-800"
          >
            Generar hoy
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-neutral-800/60">
              <th className="py-2 pr-2">Guardia</th>
              <th className="py-2 pr-2">Turno (área)</th>
              <th className="py-2 pr-2">Frecuencia</th>
              <th className="py-2 pr-2">Programación</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {planes.map((p) => (
              <tr key={p._id} className="border-b border-neutral-800/40">
                <td className="py-2 pr-2">
                  {p.guardia} {p.guardiaId ? <span className="opacity-60">· ID {p.guardiaId}</span> : null}
                </td>
                <td className="py-2 pr-2">{p.turno || p.area || "—"}</td>
                <td className="py-2 pr-2 capitalize">{p.frecuencia}</td>
                <td className="py-2 pr-2">
                  {p.frecuencia === "diaria" && `Todos los días ${p.hora}`}
                  {p.frecuencia === "semanal" &&
                    `Días ${p.diasSemana?.join(",") ?? ""} a las ${p.hora}`}
                  {p.frecuencia === "mensual" && `Día ${p.diaMes} a las ${p.hora}`}
                </td>
                <td className="py-2 pr-2">{p.activo ? "Activo" : "Pausado"}</td>
                <td className="py-2 pr-2 flex gap-2">
                  <button
                    onClick={() => activar(p, !p.activo)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-700/50 hover:bg-neutral-800"
                  >
                    {p.activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    onClick={() => borrar(p)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!planes.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center opacity-70">
                  Sin planes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
