import React from "react";
import { MODULES, TIPO_EVENTO_OPTS } from "../constants";

export default function BitacoraFilters({
  turnos,
  temp,
  setTemp,
  onApply,
  onClear,
  onExportExcel,
  onExportPDF,
}) {
  return (
    <section className="fx-card mb-4">
      <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
        <span>🔎</span> Filtros de Búsqueda
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <label className="block text-sm mb-1">Fecha Desde</label>
          <input
            type="date"
            className="input-fx input-fx--with-bubble"
            value={temp.desde}
            onChange={(e) => setTemp((p) => ({ ...p, desde: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Fecha Hasta</label>
          <input
            type="date"
            className="input-fx input-fx--with-bubble"
            value={temp.hasta}
            onChange={(e) => setTemp((p) => ({ ...p, hasta: e.target.value }))}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Agente</label>
          <input
            className="input-fx"
            value={temp.agente}
            onChange={(e) => {
              const soloLetras = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
              setTemp((p) => ({ ...p, agente: soloLetras }));
            }}
            placeholder="Buscar agente…"
            onKeyDown={(e) => {
              if (e.key === "Enter") onApply();
            }}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Turno</label>
          <select
            className="input-fx"
            value={temp.turno}
            onChange={(e) => setTemp((p) => ({ ...p, turno: e.target.value }))}
          >
            {turnos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Tipo de Evento</label>
          <select
            className="input-fx"
            value={temp.tipo}
            onChange={(e) => setTemp((p) => ({ ...p, tipo: e.target.value }))}
          >
            {TIPO_EVENTO_OPTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Módulo</label>
          <select
            className="input-fx"
            value={temp.modulo}
            onChange={(e) => setTemp((p) => ({ ...p, modulo: e.target.value }))}
          >
            {["Todos", ...MODULES].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={onApply}
          className="rounded-xl px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
        >
          Buscar
        </button>
        <button
          onClick={onClear}
          className="rounded-xl px-3 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5"
        >
          Limpiar Filtros
        </button>
        <button
          onClick={onExportExcel}
          className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5"
        >
          Exportar Filtrados (.XLS con estilo)
        </button>
        <button
          onClick={onExportPDF}
          className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5"
        >
          Descargar PDF
        </button>
      </div>
    </section>
  );
}