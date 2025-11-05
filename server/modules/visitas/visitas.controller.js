// client/src/pages/VisitasControlPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/** ───────── Helpers de formato ───────── **/
function fmtFechaHora(d) {
  if (!d) return "-";
  const dt = new Date(d);
  const dia = dt.toLocaleDateString("es-HN", { day: "numeric" });
  const mes = dt.toLocaleDateString("es-HN", { month: "numeric" });
  const hora = dt.toLocaleTimeString("es-HN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia}/${mes}, ${hora}`;
}

/**
 * Normaliza estado a los valores del modelo:
 * "Dentro" | "Programada" | "Finalizada" | "Cancelada"
 */
function getEstado(v) {
  if (v?.estado) return v.estado; // ya viene correcto del backend
  // Inferencia defensiva para documentos viejos:
  if (v?.fechaSalida) return "Finalizada";
  // Si fue creada como agendada y aún no tiene entrada:
  if (v?.tipo === "Agendada" && !v?.fechaEntrada) return "Programada";
  // Si no hay salida y (es ingreso o ya tiene fechaEntrada):
  return "Dentro";
}

function EstadoBadge({ estado }) {
  const base = "px-2 py-1 rounded-full text-xs font-semibold";
  let classes = " bg-neutral-600/30 text-neutral-300";
  let label = estado;

  if (estado === "Dentro") {
    classes = " bg-green-500/20 text-green-300";
    label = "Dentro";
  } else if (estado === "Programada") {
    classes = " bg-yellow-500/20 text-yellow-300";
    label = "Programada";
  } else if (estado === "Cancelada") {
    classes = " bg-red-500/20 text-red-300";
    label = "Cancelada";
  } else if (estado === "Finalizada") {
    classes = " bg-neutral-600/30 text-neutral-300";
    label = "Finalizada";
  }

  return <span className={base + classes}>{label}</span>;
}

export default function VisitasControlPage() {
  const navigate = useNavigate();

  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(""); // búsqueda por nombre/documento
  const [filtro, setFiltro] = useState("todos"); // todos | Dentro | Programada | Finalizada | Cancelada

  async function cargarVisitas() {
    setLoading(true);
    try {
      const res = await fetch("/api/visitas");
      const data = await res.json();
      const items = res.ok && data?.ok ? data.items : [];
      setVisitas(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error("[visitas] fetch error:", e);
      setVisitas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarVisitas();
  }, []);

  // Lista normalizada (estado en el mismo set que tu modelo)
  const visitasNorm = useMemo(
    () => (visitas || []).map((v) => ({ ...v, estado: getEstado(v) })),
    [visitas]
  );

  // Contadores (tarjetas superiores)
  const activos = useMemo(
    () => visitasNorm.filter((v) => v.estado === "Dentro").length,
    [visitasNorm]
  );

  const totalHoy = useMemo(() => {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    const d = hoy.getDate();
    return visitasNorm.filter((v) => {
      const dt = v?.fechaEntrada ? new Date(v.fechaEntrada) : null;
      return dt && dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }, [visitasNorm]);

  const empresasVisitantes = useMemo(() => {
    const set = new Set();
    for (const v of visitasNorm) if (v?.empresa) set.add(v.empresa);
    return set.size;
  }, [visitasNorm]);

  // Búsqueda + filtro de estado
  const visitasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visitasNorm.filter((v) => {
      const okEstado = filtro === "todos" ? true : v.estado === filtro;
      if (!okEstado) return false;
      if (!term) return true;
      const nombre = String(v?.nombre || "").toLowerCase();
      const doc = String(v?.documento || "").toLowerCase();
      const emp = String(v?.empresa || "").toLowerCase();
      return nombre.includes(term) || doc.includes(term) || emp.includes(term);
    });
  }, [visitasNorm, q, filtro]);

  async function finalizarVisita(id) {
    if (!id) return;
    try {
      const res = await fetch(`/api/visitas/${id}/finalizar`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo finalizar");
      await cargarVisitas();
    } catch (e) {
      console.error("[visitas] finalizar error:", e);
      alert("No se pudo finalizar la visita");
    }
  }

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6">
      {/* FX */}
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header + tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
            Visitantes Activos (Dentro)
          </div>
          <div className="text-4xl mt-2 font-bold text-neutral-100">{activos}</div>
        </div>
        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-pink-400" />
            Total Hoy
          </div>
          <div className="text-4xl mt-2 font-bold text-neutral-100">{totalHoy}</div>
        </div>
        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            Empresas Visitantes
          </div>
          <div className="text-4xl mt-2 font-bold text-neutral-100">{empresasVisitantes}</div>
        </div>
      </div>

      {/* Barra superior: título + filtros */}
      <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/30">
        <div className="px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-100">Lista de Visitantes</h2>
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, documento o empresa"
              className="rounded-xl bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100"
            />
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="rounded-xl bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100"
            >
              <option value="todos">Todos los Estados</option>
              <option value="Dentro">Dentro</option>
              <option value="Programada">Programadas</option>
              <option value="Finalizada">Finalizadas</option>
              <option value="Cancelada">Canceladas</option>
            </select>
            <button
              onClick={cargarVisitas}
              className="px-3 py-2 rounded-md text-xs font-semibold bg-blue-600/80 text-blue-50 hover:bg-blue-600"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-4 pb-4 text-neutral-400">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="text-xs uppercase text-neutral-400 border-y border-neutral-700/40">
                <tr className="[&>th]:py-2 [&>th]:pr-4">
                  <th className="pl-4">Visitante</th>
                  <th>Documento</th>
                  <th>Empresa</th>
                  <th>Empleado</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Estado</th>
                  <th className="pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-neutral-200">
                {visitasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-neutral-400">
                      Sin registros.
                    </td>
                  </tr>
                ) : (
                  visitasFiltradas.map((it) => (
                    <tr
                      key={it._id}
                      className="border-b border-neutral-800/40 text-sm [&>td]:py-3 [&>td]:pr-4"
                    >
                      <td className="pl-4 font-medium text-neutral-100">
                        {it.nombre || "-"}
                      </td>
                      <td>{it.documento || "-"}</td>
                      <td>{it.empresa || "-"}</td>
                      <td>{it.empleado || "-"}</td>
                      <td>{fmtFechaHora(it.fechaEntrada)}</td>
                      <td>{fmtFechaHora(it.fechaSalida)}</td>
                      <td>
                        <EstadoBadge estado={it.estado} />
                      </td>
                      <td className="pr-4">
                        {it.estado === "Dentro" ? (
                          <button
                            onClick={() => finalizarVisita(it._id)}
                            className="px-2 py-1 rounded-md text-xs bg-blue-600/70 hover:bg-blue-600 text-blue-50"
                          >
                            Finalizar
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">(cerrada)</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer / navegación opcional */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/visitas/control")}
          className="text-xs text-blue-400 hover:underline"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}
