import React, { useEffect, useState } from "react";

export default function RondasPlanForm({ open, mode, zone, plan, api, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState([]); // [0..6] Dom..Sáb
  const [startTime, setStartTime] = useState("08:00");
  const [repeatEveryMinutes, setRepeatEveryMinutes] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && plan) {
      setName(plan.name || "");
      setDaysOfWeek(Array.isArray(plan.daysOfWeek) ? plan.daysOfWeek : []);
      setStartTime(plan.startTime || "08:00");
      setRepeatEveryMinutes(plan.repeatEveryMinutes || "");
      setActive(Boolean(plan.active));
    } else {
      setName("");
      setDaysOfWeek([]);
      setStartTime("08:00");
      setRepeatEveryMinutes("");
      setActive(true);
    }
  }, [open, mode, plan]);

  function toggleDay(i) {
    setDaysOfWeek(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!zone?._id) return alert("Selecciona una zona");
    const payload = {
      zoneId: zone._id,
      name: name.trim(),
      daysOfWeek,
      startTime,
      repeatEveryMinutes: repeatEveryMinutes ? Number(repeatEveryMinutes) : undefined,
      active,
    };
    if (!payload.name) return alert("El nombre es obligatorio");
    if (!payload.daysOfWeek?.length) return alert("Selecciona al menos un día");

    setSaving(true);
    try {
      if (mode === "edit" && plan?._id) {
        await api.updatePlan(plan._id, payload);
      } else {
        await api.createPlan(payload);
      }
      onSaved?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const dayNames = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-100">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="font-semibold">{mode === "edit" ? "Editar plan de ronda" : "Crear plan de ronda"}</div>
          <button className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="text-sm text-neutral-400">
            Zona: <b>{zone?.name || "—"}</b>
          </div>

          <div>
            <label className="block text-sm mb-1">Nombre del plan</label>
            <input
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={name} onChange={e=>setName(e.target.value)} placeholder="Ronda nocturna…"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Días de la semana</label>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={()=>toggleDay(i)}
                  className={`px-3 py-1 rounded-md border ${
                    daysOfWeek.includes(i)
                      ? "border-primary/70 bg-primary/10"
                      : "border-neutral-700 hover:bg-neutral-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Hora de inicio</label>
              <input
                type="time"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={startTime} onChange={e=>setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Repetir cada (min) <span className="text-neutral-500">(opcional)</span>
              </label>
              <input
                type="number" min="0" step="5"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={repeatEveryMinutes}
                onChange={e=>setRepeatEveryMinutes(e.target.value)}
                placeholder="e.g. 60"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
            <span>Activo</span>
          </label>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" className="px-3 py-2 rounded-md border border-neutral-700 hover:bg-neutral-800" onClick={onClose}>
              Cancelar
            </button>
            <button disabled={saving} className="px-3 py-2 rounded-md border border-primary/60 bg-primary/10 hover:bg-primary/20">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
