import React, { useEffect, useState } from "react";

export default function RondasPlansPanel({ zone, api, onOpenForm }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!zone?._id) { setItems([]); return; }
    setLoading(true);
    try {
      const list = await api.listPlans(zone._id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [zone?._id]);

  async function onDelete(id) {
    if (!confirm("¿Eliminar este plan de ronda?")) return;
    await api.deletePlan(id);
    await load();
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-400 font-medium">
          {zone ? `Planes de ronda — ${zone.name}` : "Planes de ronda"}
        </div>
        <button
          className="px-3 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
          onClick={() => onOpenForm({ mode: "create", zone })}
          disabled={!zone}
        >
          + Programar ronda
        </button>
      </div>

      {loading ? (
        <div className="text-neutral-400 text-sm">Cargando…</div>
      ) : !items.length ? (
        <div className="text-neutral-500 text-sm">No hay planes.</div>
      ) : (
        <ul className="space-y-2">
          {items.map(p => (
            <li key={p._id} className="rounded-xl border border-neutral-800 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-neutral-400">
                  {fmtDays(p.daysOfWeek)} · {p.startTime}
                  {p.repeatEveryMinutes ? ` · cada ${p.repeatEveryMinutes} min` : ""}
                  {p.active ? "" : " · inactivo"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
                  onClick={() => onOpenForm({ mode: "edit", plan: p })}
                >
                  Editar
                </button>
                <button
                  className="px-2 py-1 rounded-md border border-red-800 text-red-300 hover:bg-red-900/20"
                  onClick={() => onDelete(p._id)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtDays(list = []) {
  const names = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  if (!list.length) return "Sin días";
  return list.sort((a,b)=>a-b).map(i => names[i] ?? "?").join(", ");
}
