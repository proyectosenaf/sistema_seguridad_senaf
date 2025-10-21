import React, { useState } from "react";

export default function SettingsPage() {
  const [intervalMin, setIntervalMin] = useState(240);
  const [autoAlerts, setAutoAlerts] = useState(true);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Configurar</h1>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-3">
          <span className="w-64">Intervalo de tiempo (min)</span>
          <input type="number" className="bg-black/30 border border-white/10 rounded px-2 py-1"
                 value={intervalMin} onChange={e=>setIntervalMin(parseInt(e.target.value || "0", 10))}/>
        </label>

        <label className="flex items-center gap-3">
          <span className="w-64">Alertas automáticas (inmovilidad/caída)</span>
          <input type="checkbox" checked={autoAlerts} onChange={e=>setAutoAlerts(e.target.checked)} />
        </label>
      </div>

      <p className="text-sm text-white/60">*Guarda estos valores en tu storage / backend si lo deseas.</p>
    </div>
  );
}
