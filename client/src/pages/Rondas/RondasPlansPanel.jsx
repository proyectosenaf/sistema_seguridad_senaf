import React, { useEffect, useState } from "react";

export default function RondasPlansPanel({ zone, api, onOpenForm }) {
  const zoneId = zone?._id || null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!!zoneId);
  const [err, setErr] = useState("");

  async function load(id = zoneId) {
    if (!id) {
      setItems([]);
      setLoading(false);
      setErr("");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const list = await api.listPlans(id);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[RondasPlansPanel] listPlans error:", e);
      setItems([]);
      setErr(e?.response?.data?.message || e?.message || "No se pudieron cargar los planes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load(zoneId);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  async function onDelete(id) {
    if (!confirm("¿Eliminar este plan de ronda?")) return;
    try {
      await api.deletePlan(id);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "No se pudo eliminar el plan");
    }
  }

  async function toggleActive(plan) {
    if (typeof api.updatePlan !== "function") return;
    try {
      await api.updatePlan(plan._id, { active: !plan.active });
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "No se pudo actualizar el estado");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-400 font-medium">
          {zone ? `Planes de ronda — ${zone.name}` : "Planes de ronda"}
        </div>
        <button
          className="px-3 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
          onClick={() => onOpenForm?.({ mode: "create", zone })}
          disabled={!zoneId}
        >
          + Programar ronda
        </button>
      </div>

      {err && (
        <div className="mb-2 rounded-md border border-red-800/40 bg-red-900/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-neutral-400 text-sm">Cargando…</div>
      ) : !items.length ? (
        <div className="text-neutral-500 text-sm">
          {zoneId ? "No hay planes en esta zona." : "Selecciona una zona para ver sus planes."}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li
              key={p._id}
              className="rounded-xl border border-neutral-800 p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>{p.name}</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      p.active
                        ? "border-emerald-700/60 text-emerald-300"
                        : "border-neutral-700 text-neutral-400"
                    }`}
                  >
                    {p.active ? "activo" : "inactivo"}
                  </span>
                </div>

                <div className="text-xs text-neutral-400 mt-0.5">
                  {fmtDays(p.daysOfWeek)} · {p.startTime}
                  {" · "}
                  {fmtRepeat(p.repeatEveryMinutes)}
                  {fmtSLA(p.lateThresholdSeconds, p.missingThresholdSeconds)}
                </div>
              </div>

              <div className="flex gap-2">
                {typeof api.updatePlan === "function" && (
                  <button
                    className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
                    onClick={() => toggleActive(p)}
                    title={p.active ? "Desactivar" : "Activar"}
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </button>
                )}
                <button
                  className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
                  onClick={() => onOpenForm?.({ mode: "edit", plan: p })}
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
  return list.slice().sort((a,b)=>a-b).map(i => names[i] ?? "?").join(", ");
}

function fmtRepeat(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "una vez/día";
  if (n % 60 === 0) return `cada ${n/60} h`;
  return `cada ${n} min`;
}

function fmtSLA(late, miss) {
  const l = Number(late), m = Number(miss);
  const parts = [];
  if (Number.isFinite(l) && l > 0) parts.push(`tarde ${l}s`);
  if (Number.isFinite(m) && m > 0) parts.push(`perdido ${m}s`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}
