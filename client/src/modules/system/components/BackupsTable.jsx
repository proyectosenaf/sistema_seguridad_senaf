import React from "react";
import { Download, RotateCcw, Trash2 } from "lucide-react";

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value) {
  if (!value) return "Sin registro";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Sin registro";

  return d.toLocaleString();
}

export default function BackupsTable({
  backups = [],
  canRestore = false,
  canDelete = false,
  onDownload,
  onRestore,
  onDelete,
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead
            style={{
              background:
                "color-mix(in srgb, var(--card-solid) 94%, transparent)",
            }}
          >
            <tr>
              <th className="px-4 py-3 text-left">Archivo</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Tamaño</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {backups.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center opacity-70">
                  No hay respaldos disponibles.
                </td>
              </tr>
            ) : (
              backups.map((item) => (
                <tr
                  key={item.name}
                  className="border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">{formatBytes(item.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onDownload?.(item.name)}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Download size={15} />
                        Descargar
                      </button>

                      {canRestore ? (
                        <button
                          type="button"
                          onClick={() => onRestore?.(item.name)}
                          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <RotateCcw size={15} />
                          Restaurar
                        </button>
                      ) : null}

                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete?.(item.name)}
                          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-red-500"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Trash2 size={15} />
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}