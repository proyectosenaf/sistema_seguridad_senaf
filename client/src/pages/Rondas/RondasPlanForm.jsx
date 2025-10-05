// client/src/pages/Rondas/RondasPlanForm.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Props:
 *  - open: boolean
 *  - mode: "create" | "edit"
 *  - zone: { _id, name } (requerido en create)
 *  - plan: objeto plan (en edit)
 *  - api: { createPlan(payload), updatePlan(id, payload) }
 *  - onClose(): void
 *  - onSaved?(): void
 */
export default function RondasPlanForm({
  open,
  mode = "create",
  zone,
  plan,
  api,
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";

  // ---------- Estado del formulario (orden fijo) ----------
  const [name, setName] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState([]); // [0..6] = Dom..Sáb
  const [scheduleType, setScheduleType] = useState("day"); // "day" | "night"
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [repeatEveryMinutes, setRepeatEveryMinutes] = useState(0); // 0 = una vez por día
  const [lateThresholdSeconds, setLateThresholdSeconds] = useState(180);
  const [missingThresholdSeconds, setMissingThresholdSeconds] = useState(600);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // ---------- Precarga en modo edición ----------
  useEffect(() => {
    if (!open) return;
    setErrMsg("");

    if (isEdit && plan) {
      setName(plan.name || "");
      setDaysOfWeek(Array.isArray(plan.daysOfWeek) ? plan.daysOfWeek : []);
      setScheduleType(plan.scheduleType || "day");
      setStartTime(plan.startTime || "08:00");
      setEndTime(plan.endTime || "18:00");
      setRepeatEveryMinutes(
        Number.isFinite(plan.repeatEveryMinutes) ? plan.repeatEveryMinutes : 0
      );
      setLateThresholdSeconds(
        Number.isFinite(plan.lateThresholdSeconds) ? plan.lateThresholdSeconds : 180
      );
      setMissingThresholdSeconds(
        Number.isFinite(plan.missingThresholdSeconds) ? plan.missingThresholdSeconds : 600
      );
      setActive(plan.active !== false);
    } else {
      setName("");
      setDaysOfWeek([]);
      setScheduleType("day");
      setStartTime("08:00");
      setEndTime("18:00");
      setRepeatEveryMinutes(0);
      setLateThresholdSeconds(180);
      setMissingThresholdSeconds(600);
      setActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, plan?._id]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ---------- Derivados ----------
  const zoneName = useMemo(
    () => (isEdit ? plan?.zone?.name || plan?.zoneName : zone?.name) || "",
    [isEdit, plan, zone]
  );

  // Validación
  const validate = () => {
    if (!isEdit && !zone?._id) return "Falta la zona activa.";
    if (!name.trim()) return "Ingresa el nombre del plan.";
    if (!daysOfWeek.length) return "Selecciona al menos un día.";
    if (!/^\d{2}:\d{2}$/.test(startTime)) return "Hora de inicio inválida.";
    if (!/^\d{2}:\d{2}$/.test(endTime)) return "Hora final inválida.";
    const rep = Number(repeatEveryMinutes);
    const late = Number(lateThresholdSeconds);
    const miss = Number(missingThresholdSeconds);
    if (!Number.isFinite(rep) || rep < 0) return "Repetición inválida (minutos ≥ 0).";
    if (!Number.isFinite(late) || late < 0) return "Tolerancia tarde inválida (segundos ≥ 0).";
    if (!Number.isFinite(miss) || miss < 0) return "Vencimiento inválido (segundos ≥ 0).";

    // En diurna, fin >= inicio. En nocturna puede cruzar medianoche.
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (scheduleType === "day" && endMins < startMins) {
      return "En jornada diurna, la hora final debe ser mayor o igual a la de inicio.";
    }
    return null;
  };

  // Mostrar mensaje de validación en vivo (mismo único useMemo que antes)
  const validationError = useMemo(() => validate(), [
    name, daysOfWeek, scheduleType, startTime, endTime,
    repeatEveryMinutes, lateThresholdSeconds, missingThresholdSeconds, zone?._id
  ]);
  const isValid = !validationError;

  // ---------- Handlers ----------
  const dayNames = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  function toggleDay(i) {
    setDaysOfWeek((prev) => {
      const set = new Set(prev);
      set.has(i) ? set.delete(i) : set.add(i);
      return Array.from(set).sort((a,b)=>a-b);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setErrMsg(err); return; }

    const payload = {
      name: name.trim(),
      zoneId: isEdit ? (plan.zoneId || plan.zone?._id) : zone._id,
      daysOfWeek: daysOfWeek.slice().sort((a,b)=>a-b),
      scheduleType,
      startTime,
      endTime,
      repeatEveryMinutes: Number(repeatEveryMinutes),
      lateThresholdSeconds: Number(lateThresholdSeconds),
      missingThresholdSeconds: Number(missingThresholdSeconds),
      active: !!active,
    };

    try {
      setSaving(true);
      setErrMsg("");
      if (isEdit) await api.updatePlan(plan._id, payload);
      else await api.createPlan(payload);
      onClose?.();
      onSaved?.();
    } catch (e2) {
      console.error(e2);
      setErrMsg(e2?.response?.data?.message || e2?.message || "No se pudo guardar el plan");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // ---------- UI ----------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !saving && onClose?.()} />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-3xl mx-4 rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="font-semibold text-lg">
            {isEdit ? "Editar plan de ronda" : "Crear plan de ronda"}
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose?.()}
            className="px-3 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
          >
            Cerrar
          </button>
        </div>

        {errMsg && (
          <div className="px-4 pt-3">
            <div className="rounded-md border border-red-800/40 bg-red-900/10 px-3 py-2 text-sm text-red-300">
              {errMsg}
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm text-neutral-400">Zona:</div>
            <div className="font-medium">{zoneName || "—"}</div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Nombre del plan</label>
            <input
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="Ronda nocturna…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Días de la semana</div>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((n, i) => {
                const on = daysOfWeek.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1 rounded-md border transition ${
                      on ? "border-primary/60 bg-primary/10" : "border-neutral-700 hover:bg-neutral-800"
                    }`}
                    aria-pressed={on}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-neutral-400 mb-1">Jornada</div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="day"
                    checked={scheduleType === "day"}
                    onChange={() => setScheduleType("day")}
                  />
                  Diurna
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="night"
                    checked={scheduleType === "night"}
                    onChange={() => setScheduleType("night")}
                  />
                  Nocturna
                </label>
              </div>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Activo
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Hora de inicio</label>
              <input
                type="time"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Hora final {scheduleType === "night" && "(puede cruzar medianoche)"}
              </label>
              <input
                type="time"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Repetición (min)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={repeatEveryMinutes}
                onChange={(e) => setRepeatEveryMinutes(e.target.value)}
              />
              <div className="text-xs text-neutral-500 mt-1">0 = una vez por día</div>
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-1">Tarde (seg)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={lateThresholdSeconds}
                onChange={(e) => setLateThresholdSeconds(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-1">Perdido (seg)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={missingThresholdSeconds}
                onChange={(e) => setMissingThresholdSeconds(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex items-center justify-end gap-2">
          {!isValid && (
            <div className="mr-auto text-xs text-red-300">
              {validationError}
            </div>
          )}
          <button
            type="button"
            onClick={() => !saving && onClose?.()}
            className="px-4 py-2 rounded-md border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-md border border-primary/60 bg-primary/20 hover:bg-primary/30 disabled:opacity-50"
            disabled={saving || !isValid}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
