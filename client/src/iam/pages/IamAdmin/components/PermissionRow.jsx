import React, { memo } from "react";
import RoleCheck from "./RoleCheck";

/** Fila de permiso con primera columna sticky en X */
function PermissionRow({ item, roles, gridCols, flags, dirty, onToggle, onDelete }) {
  return (
    <div
      className={
        "grid items-center px-4 py-2 hover:bg-neutral-50/40 dark:hover:bg-neutral-900/60 " +
        (dirty ? "ring-1 ring-amber-300/60" : "")
      }
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Columna izquierda fija; fondo translúcido + blur */}
      <div className="min-w-0 sticky left-0 z-30 pr-4 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md shadow-[2px_0_0_0_rgba(0,0,0,0.35)]">
        <div className="font-mono text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 truncate">
          {item.key}
        </div>
        <div className="text-sm text-neutral-900 dark:text-neutral-100">
          {item.label}
        </div>
      </div>

      {roles.map((r) => (
        <div key={r._id} className="flex items-center justify-center">
          <RoleCheck
            checked={!!flags[r._id]}
            onChange={() => onToggle(item.key, r._id)}
            label={`${r.name || r.code} puede ${item.label}`}
          />
        </div>
      ))}

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          title="Eliminar"
          onClick={() => onDelete(item)}
          className="p-1.5 rounded-md bg-neutral-200/80 text-neutral-800 hover:bg-neutral-300/90 dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:bg-neutral-700/90 backdrop-blur-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default memo(PermissionRow, (prev, next) => {
  if (prev.dirty !== next.dirty) return false;
  if (prev.roles.length !== next.roles.length) return false;
  const p = prev.flags;
  const n = next.flags;
  for (const r of next.roles) {
    if (Boolean(p[r._id]) !== Boolean(n[r._id])) return false;
  }
  return true;
});
