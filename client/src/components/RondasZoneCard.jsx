import React from "react";

export default function RondasZoneCard({ zone, onStart, onPlan, disabled = false }) {
  if (!zone) return null;

  const { _id, name, code, description, active, checkpoints } = zone;
  const hasId = Boolean(_id);
  const cpCount =
    Array.isArray(checkpoints) ? checkpoints.length :
    typeof zone?.checkpointsCount === "number" ? zone.checkpointsCount :
    null;

  const handleStart = () => {
    // Compatibilidad: primer arg = zone (como usabas), segundo arg = id
    onStart?.(zone, _id);
  };

  return (
    <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{name || "Zona"}</div>
          <div className="text-sm text-neutral-400">{code || "—"}</div>
          {description && (
            <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
              {description}
            </div>
          )}
          <div className="text-xs text-neutral-500 mt-1 flex gap-3">
            {typeof active === "boolean" && (
              <span>{active ? "Activa" : "Inactiva"}</span>
            )}
            {cpCount !== null && <span>Checkpoints: {cpCount}</span>}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
            onClick={handleStart}
            disabled={!hasId || disabled}
            aria-label={`Iniciar ronda en ${name || code || "zona"}`}
          >
            Iniciar ronda
          </button>

          {typeof onPlan === "function" && (
            <button
              type="button"
              className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
              onClick={() => onPlan(zone)}
              disabled={!hasId || disabled}
              aria-label={`Programar rondas para ${name || code || "zona"}`}
            >
              Programar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
