import React from "react";
import { MODULES, TIPO_EVENTO_OPTS } from "../constants";

export default function BitacoraFilters({
  turnos = [],
  temp,
  setTemp,
  onApply,
  onClear,
  onExportExcel,
  onExportPDF,
}) {
  return (
    <section className="fx-card mb-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span>🔎</span> Filtros de Búsqueda
      </h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div>
          <label className="mb-1 block text-sm">Fecha Desde</label>
          <input
            type="date"
            className="input-fx input-fx--with-bubble"
            value={temp?.desde || ""}
            onChange={(e) =>
              setTemp((prev) => ({ ...prev, desde: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Fecha Hasta</label>
          <input
            type="date"
            className="input-fx input-fx--with-bubble"
            value={temp?.hasta || ""}
            onChange={(e) =>
              setTemp((prev) => ({ ...prev, hasta: e.target.value }))
            }
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm">Agente</label>
          <input
            className="input-fx"
            value={temp?.agente || ""}
            onChange={(e) => {
              const soloLetras = e.target.value.replace(
                /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,
                ""
              );
              setTemp((prev) => ({ ...prev, agente: soloLetras }));
            }}
            placeholder="Buscar agente…"
            onKeyDown={(e) => {
              if (e.key === "Enter") onApply?.();
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Turno</label>
          <select
            className="input-fx"
            value={temp?.turno || ""}
            onChange={(e) =>
              setTemp((prev) => ({ ...prev, turno: e.target.value }))
            }
          >
            {turnos.map((turno) => (
              <option key={turno} value={turno}>
                {turno}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm">Tipo de Evento</label>
          <select
            className="input-fx"
            value={temp?.tipo || ""}
            onChange={(e) =>
              setTemp((prev) => ({ ...prev, tipo: e.target.value }))
            }
          >
            {TIPO_EVENTO_OPTS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm">Módulo</label>
          <select
            className="input-fx"
            value={temp?.modulo || ""}
            onChange={(e) =>
              setTemp((prev) => ({ ...prev, modulo: e.target.value }))
            }
          >
            {["Todos", ...MODULES].map((modulo) => (
              <option key={modulo} value={modulo}>
                {modulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-xl border border-neutral-300 bg-black/5 px-3 py-2 hover:bg-black/10 dark:border-neutral-700 dark:bg-white/5 dark:hover:bg-white/10"
        >
          Buscar
        </button>

        <button
          type="button"
          onClick={onClear}
          className="rounded-xl border border-neutral-300 px-3 py-2 hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
        >
          Limpiar Filtros
        </button>

        <button
          type="button"
          onClick={onExportExcel}
          className="rounded-xl border border-neutral-300 px-3 py-2 hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
        >
          Exportar Filtrados (.XLS con estilo)
        </button>

        <button
          type="button"
          onClick={onExportPDF}
          className="rounded-xl border border-neutral-300 px-3 py-2 hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
        >
          Descargar PDF
        </button>
      </div>
    </section>
  );
}