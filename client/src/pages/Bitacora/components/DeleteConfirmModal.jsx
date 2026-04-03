import React from "react";
import { monthNameES } from "../utils/bitacora.formatters";

export default function DeleteConfirmModal({
  row,
  error = "",
  deleting = false,
  onCancel,
  onConfirm,
}) {
  if (!row) return null;

  const actorName = row.agente || row.actorEmail || row.nombre || "—";
  const itemType = String(row.tipo || "evento").toLowerCase();
  const monthLabel = monthNameES(row.fecha);

  const handleBackdropClick = () => {
    if (deleting) return;
    onCancel?.();
  };

  const handleCancel = () => {
    if (deleting) return;
    onCancel?.();
  };

  const handleConfirm = () => {
    if (deleting) return;
    onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleBackdropClick}
      />

      <div className="layer-content relative w-full max-w-lg rounded-2xl border border-neutral-700/40 bg-neutral-900/95 text-neutral-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-600/20 text-rose-400">
              !
            </span>
            <h3 className="font-semibold">Confirmar archivado</h3>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <p className="leading-relaxed">
            ¿Archivar el <strong>{itemType}</strong> de <strong>{actorName}</strong>{" "}
            correspondiente a <strong>{monthLabel}</strong>?
          </p>

          <p className="opacity-80">
            El registro no se eliminará físicamente. Quedará oculto de la
            bitácora principal y podrá restaurarse después.
          </p>

          {!!error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={deleting}
            className="rounded-lg border border-white/15 px-4 py-2 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Archivando..." : "Archivar"}
          </button>
        </div>
      </div>
    </div>
  );
}