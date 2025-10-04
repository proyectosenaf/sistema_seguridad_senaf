// client/src/pages/Rondas/RondasDashboard.jsx
import React from "react";

export default function RondasDashboard() {
  return (
    <section className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">Rondas – Información General</h1>
      <p className="text-neutral-400">
        Aquí se mostrará el resumen general, estadísticas y reportes de rondas.
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Rondas simples realizadas</div>
          <div className="text-3xl font-semibold mt-2">0</div>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Áreas registradas con rondas</div>
          <div className="text-3xl font-semibold mt-2">0</div>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400">Usuarios reportantes</div>
          <div className="text-3xl font-semibold mt-2">0</div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-400 mb-2">Información de Áreas</div>
        <div className="text-neutral-500 text-sm">Sin datos en el rango seleccionado</div>
      </div>
    </section>
  );
}
