import React from "react";

export default function RondasCheckpointCard({ cp, onOpenQR }) {
  if (!cp) return null;

  const { _id, name, code, order, expectedSecondsFromStart, graceSeconds, zone } = cp;

  const handleOpenQR = () => {
    // pasa el id (y opcionalmente el objeto completo como 2º arg)
    onOpenQR?.(_id, cp);
  };

  return (
    <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 flex items-center justify-between">
      <div>
        <div className="font-medium">
          {name || "Checkpoint"}{" "}
          <span className="text-xs text-neutral-400">({code || "—"})</span>
        </div>

        <div className="text-xs text-neutral-500 flex gap-3 flex-wrap">
          <span>Orden: {order ?? "—"}</span>
          {typeof expectedSecondsFromStart === "number" && (
            <span>t+{Math.round(expectedSecondsFromStart / 60)} min</span>
          )}
          {typeof graceSeconds === "number" && <span>gracia: {graceSeconds}s</span>}
          {zone?.name && <span>Zona: {zone.name}</span>}
        </div>
      </div>

      <button
        type="button"
        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
        onClick={handleOpenQR}
        disabled={!_id}
        aria-label={`Ver QR de ${name || code || "checkpoint"}`}
      >
        Ver QR
      </button>
    </div>
  );
}
