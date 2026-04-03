import React from "react";

export default function RestoreBackupModal({
  open,
  backupName,
  busy,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
        style={{
          background: "var(--card-solid)",
          borderColor: "var(--border)",
        }}
      >
        <h3 className="text-lg font-semibold">Confirmar restauración</h3>

        <p className="mt-3 text-sm opacity-80">
          Vas a restaurar el respaldo:
        </p>

        <div
          className="mt-2 rounded-xl border p-3 text-sm font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          {backupName}
        </div>

        <p className="mt-4 text-sm text-red-500">
          Esta operación puede sobrescribir datos actuales del sistema.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border px-4 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white"
          >
            {busy ? "Restaurando..." : "Sí, restaurar"}
          </button>
        </div>
      </div>
    </div>
  );
}