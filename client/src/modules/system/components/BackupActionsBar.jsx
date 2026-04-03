import React from "react";
import { RefreshCw, DatabaseBackup } from "lucide-react";

export default function BackupActionsBar({
  busy = false,
  onRefresh,
  onCreateBackup,
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 disabled:opacity-60"
        style={{ borderColor: "var(--border)" }}
      >
        <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
        Actualizar
      </button>

      <button
        type="button"
        onClick={onCreateBackup}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-medium text-white disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
        }}
      >
        <DatabaseBackup size={16} />
        {busy ? "Procesando..." : "Generar respaldo"}
      </button>
    </div>
  );
}