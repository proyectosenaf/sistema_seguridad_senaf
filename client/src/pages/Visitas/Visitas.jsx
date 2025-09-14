// client/src/pages/Visitas/Visitas.jsx
import React from "react";
import { api } from "../../lib/api.js";
import { useCrud } from "../../lib/useCrud.js";

const Pill = ({ estado }) => (
  <span
    className={
      "px-2 py-1 rounded-full text-xs " +
      (estado === "en_curso"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-emerald-500/15 text-emerald-300")
    }
  >
    {estado === "en_curso" ? "En curso" : "Finalizada"}
  </span>
);

export default function Visitas() {
  const { items, list } = useCrud("visitas");
  const [form, setForm] = React.useState({ nombre: "", documento: "", motivo: "" });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { list({ limit: 100 }); }, [list]);

  async function guardar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/visitas", form);
      setForm({ nombre: "", documento: "", motivo: "" });
      list({ limit: 100 });
    } finally { setLoading(false); }
  }

  async function finalizar(id) {
    setLoading(true);
    try {
      await api.patch(`/visitas/${id}/finalizar`);
      list({ limit: 100 });
    } finally { setLoading(false); }
  }

  async function reabrir(id) {
    setLoading(true);
    try {
      await api.patch(`/visitas/${id}/reabrir`);
      list({ limit: 100 });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={guardar} className="card max-w-2xl space-y-3">
        <h2 className="font-semibold text-lg">Nueva visita</h2>
        <input
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Documento"
          value={form.documento}
          onChange={(e) => setForm({ ...form, documento: e.target.value })}
          required
        />
        <input
          className="w-full px-3 py-2 rounded-lg border border-neutral-700/50"
          placeholder="Motivo"
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
        />
        <button disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">
          {loading ? "Guardando…" : "Guardar"}
        </button>
      </form>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-3">Visitas</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-neutral-800/60">
              <th className="py-2 pr-2">Nombre</th>
              <th className="py-2 pr-2">Documento</th>
              <th className="py-2 pr-2">Motivo</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v._id} className="border-b border-neutral-800/40">
                <td className="py-2 pr-2">{v.nombre}</td>
                <td className="py-2 pr-2">{v.documento}</td>
                <td className="py-2 pr-2">{v.motivo || "—"}</td>
                <td className="py-2 pr-2"><Pill estado={v.estado} /></td>
                <td className="py-2 pr-2">
                  {v.estado === "en_curso" ? (
                    <button
                      onClick={() => finalizar(v._id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500"
                    >
                      Finalizar
                    </button>
                  ) : (
                    <button
                      onClick={() => reabrir(v._id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-500"
                    >
                      Reabrir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={5} className="py-6 text-center opacity-70">Sin visitas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// Página para gestionar el control de visitas (registro, estado)