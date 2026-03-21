import React from "react";
import { MODULES } from "../constants";
import { percent } from "../utils/bitacora.formatters";
import ProgressBar from "./ProgressBar";

const MODULE_GRADIENTS = {
  Todos: "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)",
  "Control de Acceso": "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)",
  "Rondas de Vigilancia": "linear-gradient(90deg, #67e8f9 0%, #86efac 100%)",
  "Control de Visitas": "linear-gradient(90deg, #93c5fd 0%, #99f6e4 100%)",
  "Gestión de Incidentes": "linear-gradient(90deg, #60a5fa 0%, #7dd3fc 100%)",
};

const TURNO_GRADIENT = "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)";

function cardStyle() {
  return {
    background: "color-mix(in srgb, var(--panel) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
  };
}

export default function BitacoraAnalytics({ rows = [] }) {
  const totalRows = rows.length || 1;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="fx-card rounded-[24px] p-5" style={cardStyle()}>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <span>📊</span>
          <span style={{ color: "var(--text)" }}>Eventos por Módulo</span>
        </h3>

        <div className="space-y-4">
          {MODULES.map((mod) => {
            const count = rows.filter((r) => r.modulo === mod).length;
            const pctVal = percent(count, totalRows);

            return (
              <div key={mod} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm gap-3">
                  <span style={{ color: "var(--text)" }}>{mod}</span>
                  <span
                    className="shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {count} eventos ({pctVal}%)
                  </span>
                </div>

                <ProgressBar
                  value={pctVal}
                  gradient={
                    MODULE_GRADIENTS[mod] ||
                    "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)"
                  }
                  height={12}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fx-card rounded-[24px] p-5" style={cardStyle()}>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <span>🕒</span>
          <span style={{ color: "var(--text)" }}>Distribución por Turno</span>
        </h3>

        <div className="space-y-4">
          {["Mañana", "Tarde", "Noche"].map((turno) => {
            const count = rows.filter((r) => r.turno === turno).length;
            const pctVal = percent(count, totalRows);

            return (
              <div key={turno} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm gap-3">
                  <span style={{ color: "var(--text)" }}>Turno {turno}</span>
                  <span
                    className="shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {count} eventos ({pctVal}%)
                  </span>
                </div>

                <ProgressBar
                  value={pctVal}
                  gradient={TURNO_GRADIENT}
                  height={12}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}