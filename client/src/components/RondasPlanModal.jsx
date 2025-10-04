import React, { useEffect, useState } from "react";

export default function RondasPlanModal({ open, onClose, api, zone, plan, onSaved }) {
  const editing = Boolean(plan?._id);
  const [form, setForm] = useState({
    name: "",
    zoneId: zone?._id || "",
    daysOfWeek: [],
    startTime: "08:00",
    repeatEveryMinutes: 0,
    lateThresholdSeconds: 180,
    active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: plan.name || "",
        zoneId: plan.zoneId || zone?._id || "",
        daysOfWeek: plan.daysOfWeek || [],
        startTime: plan.startTime || "08:00",
        repeatEveryMinutes: plan.repeatEveryMinutes ?? 0,
        lateThresholdSeconds: plan.lateThresholdSeconds ?? 180,
        active: plan.active ?? true,
      });
    } else {
      setForm(f => ({ ...f, zoneId: zone?._id || "" }));
    }
  }, [open, editing, plan, zone]);

  function toggleDay(d) {
    setForm(f => {
      const has = f.daysOfWeek.includes(d);
      return { ...f, daysOfWeek: has ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d] };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.updatePlan(plan._id, form);
      else await api.createPlan(form);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="text-lg font-semibold mb-3">
          {editing ? "Editar plan de ronda" : "Programar nueva ronda"}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-neutral-400">Nombre</label>
            <input
              className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="text-sm text-neutral-400">Zona</label>
            <input
              className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 cursor-not-allowed"
              value={zone?.name || ""}
              readOnly
            />
          </div>

          <div>
            <label className="text-sm text-neutral-400">Días</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((d,i)=>(
                <button type="button" key={i}
                  className={`px-2 py-1 rounded-md border ${form.daysOfWeek.includes(i) ? "border-primary/60 bg-primary/10" : "border-neutral-700"}`}
                  onClick={() => toggleDay(i)}
                >{d}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-neutral-400">Hora de inicio</label>
              <input type="time"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Repetición (minutos)</label>
              <input type="number" min="0"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.repeatEveryMinutes}
                onChange={e => setForm(f => ({ ...f, repeatEveryMinutes: Number(e.target.value) }))}
              />
              <div className="text-xs text-neutral-500 mt-1">0 = una vez por día</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-neutral-400">Tolerancia (segundos)</label>
              <input type="number" min="0"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.lateThresholdSeconds}
                onChange={e => setForm(f => ({ ...f, lateThresholdSeconds: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                />
                <span>Activo</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-2 rounded-md border border-neutral-700" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="px-3 py-2 rounded-md border border-primary/60 bg-primary/10" disabled={saving}>
              {saving ? "Guardando…" : (editing ? "Guardar cambios" : "Crear plan")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
