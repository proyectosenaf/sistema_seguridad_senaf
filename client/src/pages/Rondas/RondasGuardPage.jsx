import React, { useEffect, useMemo, useState } from "react";

/**
 * Props:
 *  - open: boolean
 *  - mode: "create" | "edit"
 *  - zone: { _id, name } (requerido en create)
 *  - plan: objeto plan (en edit)
 *  - api: { createPlan(payload), updatePlan(id, payload) }
 *  - onClose(): void
 *  - onSaved?(): void   // opcional
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

  // ---------- Estado del formulario ----------
  const [name, setName] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState([]); // [0..6] = Dom..Sáb
  const [scheduleType, setScheduleType] = useState("day"); // "day" | "night"
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---------- Precarga en modo edición ----------
  useEffect(() => {
    if (!open) return;

    if (isEdit && plan) {
      setName(plan.name || "");
      setDaysOfWeek(Array.isArray(plan.daysOfWeek) ? plan.daysOfWeek : []);
      setScheduleType(plan.scheduleType || "day");
      setStartTime(plan.startTime || "08:00");
      setEndTime(plan.endTime || "18:00");
      setActive(plan.active !== false);
    } else {
      // defaults para crear
      setName("");
      setDaysOfWeek([]);
      setScheduleType("day");
      setStartTime("08:00");
      setEndTime("18:00");
      setActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, plan?._id]);

  const zoneName = useMemo(
    () => (isEdit ? plan?.zone?.name || plan?.zoneName : zone?.name) || "",
    [isEdit, plan, zone]
  );

  if (!open) return null;

  // ---------- Helpers UI ----------
  const dayNames = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  function toggleDay(i) {
    setDaysOfWeek((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
    );
  }

  function validate() {
    if (!isEdit && !zone?._id) return "Falta la zona activa.";
    if (!name.trim()) return "Ingresa el nombre del plan.";
    if (!daysOfWeek.length) return "Selecciona al menos un día.";
    if (!/^\d{2}:\d{2}$/.test(startTime)) return "Hora de inicio inválida.";
    if (!/^\d{2}:\d{2}$/.test(endTime)) return "Hora final inválida.";
    // (opcional) puedes validar que endTime sea > startTime según tus reglas
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) {
      alert(err);
      return;
    }

    const payload = {
      name: name.trim(),
      zoneId: isEdit ? (plan.zoneId || plan.zone?._id) : zone._id,
      daysOfWeek: daysOfWeek.slice().sort((a,b)=>a-b),
      scheduleType,          // "day" | "night"
      startTime,             // "HH:mm"
      endTime,               // "HH:mm"
      active: !!active,
    };

    try {
      setSaving(true);
      if (isEdit) {
        await api.updatePlan(plan._id, payload);
      } else {
        await api.createPlan(payload);
      }
      onClose?.();
      onSaved?.();
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el plan: " + (e?.message || "error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !saving && onClose?.()}
      />

      {/* modal */}
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

        <div className="p-4 space-y-4">
          {/* Zona */}
          <div>
            <div className="text-sm text-neutral-400">Zona:</div>
            <div className="font-medium">{zoneName || "—"}</div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Nombre del plan
            </label>
            <input
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="Ronda nocturna…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Días de la semana */}
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
                      on
                        ? "border-primary/60 bg-primary/10"
                        : "border-neutral-700 hover:bg-neutral-800"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Jornada (Diurna/Nocturna) */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-neutral-400 mb-1">Jornada</div>
              <div className="flex gap-2">
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

            {/* Activo */}
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Activo
              </label>
            </div>
          </div>

          {/* Horarios */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Hora de inicio
              </label>
              <input
                type="time"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Hora final
              </label>
              <input
                type="time"
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => !saving && onClose?.()}
            className="px-4 py-2 rounded-md border border-neutral-700 hover:bg-neutral-800"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-md border border-primary/60 bg-primary/20 hover:bg-primary/30"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
