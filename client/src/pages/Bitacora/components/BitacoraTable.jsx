import React from "react";
import Pill from "./Pill";
import {
  clampTxt,
  estadoTone,
  fmtDateTime,
  prioridadTone,
} from "../utils/bitacora.formatters";

export default function BitacoraTable({
  rows = [],
  onView,
  onDelete,
  deletingId = "",
}) {
  return (
    <section className="fx-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span>🗂️</span> Registro de Eventos ({rows.length})
          </h3>
          <p className="text-sm opacity-75">
            Historial cronológico de todas las actividades del sistema
          </p>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2 pr-3 font-bold">Fecha y Hora</th>
              <th className="py-2 pr-3 font-bold">Actor</th>
              <th className="py-2 pr-3 font-bold">Rol</th>
              <th className="py-2 pr-3 font-bold">Módulo</th>
              <th className="py-2 pr-3 font-bold">Acción</th>
              <th className="py-2 pr-3 font-bold">Descripción</th>
              <th className="py-2 pr-3 font-bold">Prioridad</th>
              <th className="py-2 pr-3 font-bold">Estado</th>
              <th className="py-2 pr-3 font-bold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const rowId = String(r.id || r._id || "");
              const isDeleting = rowId && rowId === String(deletingId || "");

              return (
                <tr
                  key={rowId}
                  className="align-top border-b border-neutral-200/70 dark:border-neutral-800/70"
                >
                  <td className="whitespace-nowrap py-2 pr-3">
                    <div className="font-semibold">
                      {fmtDateTime(r.fecha)}
                    </div>
                  </td>

                  <td className="py-2 pr-3">
                    <div className="font-medium">
                      {r.actorEmail || r.agente || r.nombre || "—"}
                    </div>
                  </td>

                  <td className="py-2 pr-3">
                    {r.actorRol || "—"}
                  </td>

                  <td className="py-2 pr-3">{r.modulo}</td>

                  <td className="py-2 pr-3">
                    <span className="font-semibold">
                      {r.accion || "—"}
                    </span>
                  </td>

                  <td className="py-2 pr-3">
                    <span title={r.descripcion}>
                      {clampTxt(r.descripcion, 90)}
                    </span>
                  </td>

                  <td className="py-2 pr-3">
                    <Pill tone={prioridadTone(r.prioridad)}>
                      {r.prioridad}
                    </Pill>
                  </td>

                  <td className="py-2 pr-3">
                    <Pill tone={estadoTone(r.estado)}>
                      {r.estado}
                    </Pill>
                  </td>

                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-neutral-300 px-2 py-1 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-white/5"
                        onClick={() => onView(r)}
                        disabled={isDeleting}
                      >
                        Ver
                      </button>

                      <button
                        type="button"
                        className="rounded-lg border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-600 dark:text-rose-300"
                        onClick={() => onDelete(r)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Archivando..." : "Archivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center opacity-70">
                  No hay resultados con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}