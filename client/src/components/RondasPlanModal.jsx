import React, { useEffect, useMemo, useState } from "react";

const DAY_LABELS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function normalizeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function RondasPlanModal({ open, onClose, api, zone, plan, onSaved }) {
  const editing = Boolean(plan?._id);

  const [form, setForm] = useState({
    name: "",
    zoneId: zone?._id || "",
    daysOfWeek: [],
    startTime: "08:00",
    repeatEveryMinutes: 0,          // 0 => una vez al día
    lateThresholdSeconds: 180,
    missingThresholdSeconds: 600,   // ventana para "missed"
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // Cargar/Resetear valores al abrir o cambiar plan/zona
  useEffect(() => {
    if (!open) return;
    setErrMsg("");
    if (editing) {
      setForm({
        name: plan?.name || "",
        zoneId: plan?.zoneId || zone?._id || "",
        daysOfWeek: Array.isArray(plan?.daysOfWeek) ? plan.daysOfWeek : [],
        startTime: plan?.startTime || "08:00",
        repeatEveryMinutes: normalizeNumber(plan?.repeatEveryMinutes, 0),
        lateThresholdSeconds: normalizeNumber(plan?.lateThresholdSeconds, 180),
        missingThresholdSeconds: normalizeNumber(plan?.missingThresholdSeconds, 600),
        active: typeof plan?.active === "boolean" ? plan.active : true,
      });
    } else {
      setForm(f => ({
        ...f,
        zoneId: zone?._id || "",
      }));
    }
  }, [open, editing, plan, zone]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggleDay(d) {
    setForm(f => {
      const set = new Set(f.daysOfWeek);
      set.has(d) ? set.delete(d) : set.add(d);
      return { ...f, daysOfWeek: Array.from(set).sort((a,b)=>a-b) };
    });
  }

  // Validación mínima
  const isValid = useMemo(() => {
    if (!form.name?.trim() || form.name.trim().length < 2) return false;
    if (!form.zoneId) return false;
    if (!Array.isArray(form.daysOfWeek) || form.daysOfWeek.length === 0) return false;
    if (!/^\d{2}:\d{2}$/.test(form.startTime)) return false;
    if (normalizeNumber(form.repeatEveryMinutes, -1) < 0) return false;
    if (normalizeNumber(form.lateThresholdSeconds, -1) < 0) return false;
    if (normalizeNumber(form.missingThresholdSeconds, -1) < 0) return false;
    return true;
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setErrMsg("");
    if (!isValid) {
      setErrMsg("Revisa los campos: nombre, zona, días y umbrales.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        // Normaliza números por si vinieron como string del input
        repeatEveryMinutes: normalizeNumber(form.repeatEveryMinutes, 0),
        lateThresholdSeconds: normalizeNumber(form.lateThresholdSeconds, 180),
        missingThresholdSeconds: normalizeNumber(form.missingThresholdSeconds, 600),
        // daysOfWeek únicos y ordenados
        daysOfWeek: Array.from(new Set(form.daysOfWeek)).sort((a,b)=>a-b),
      };

      if (editing) await api.updatePlan?.(plan._id, payload);
      else         await api.createPlan?.(payload);

      onSaved?.(payload);
      onClose?.();
    } catch (err) {
      console.error("[PlanModal] save error:", err);
      setErrMsg(err?.response?.data?.message || err?.message || "No se pudo guardar el plan");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 grid place-items-center z-50"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // cerrar al hacer click en el backdrop (no dentro del modal)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="text-lg font-semibold mb-3">
          {editing ? "Editar plan de ronda" : "Programar nueva ronda"}
        </div>

        {errMsg && (
          <div className="mb-3 text-sm text-red-400 border border-red-800/50 bg-red-900/10 rounded-md px-3 py-2">
            {errMsg}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-neutral-400">Nombre</label>
            <input
              className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ronda nocturna quirófanos"
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
              {DAY_LABELS.map((d, i) => {
                const active = form.daysOfWeek.includes(i);
                return (
                  <button
                    type="button"
                    key={i}
                    className={`px-2 py-1 rounded-md border transition
                      ${active ? "border-primary/60 bg-primary/10" : "border-neutral-700 hover:border-neutral-500"}`}
                    onClick={() => toggleDay(i)}
                    aria-pressed={active}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-neutral-400">Hora de inicio</label>
              <input
                type="time"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Repetición (minutos)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.repeatEveryMinutes}
                onChange={e => setForm(f => ({ ...f, repeatEveryMinutes: e.target.value }))}
              />
              <div className="text-xs text-neutral-500 mt-1">0 = una vez por día</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-neutral-400">Tolerancia tarde (seg)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.lateThresholdSeconds}
                onChange={e => setForm(f => ({ ...f, lateThresholdSeconds: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Vencimiento (missed, seg)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="w-full mt-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={form.missingThresholdSeconds}
                onChange={e => setForm(f => ({ ...f, missingThresholdSeconds: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              />
              <span>Activo</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-2 rounded-md border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded-md border border-primary/60 bg-primary/10 disabled:opacity-50"
                disabled={saving || !isValid}
              >
                {saving ? "Guardando…" : (editing ? "Guardar cambios" : "Crear plan")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
