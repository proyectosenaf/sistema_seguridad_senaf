import React from "react";

export default function AgendaHeader({ isVisitante = false, onBack }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1
          className="text-xl md:text-2xl font-bold"
          style={{ color: "var(--text)" }}
        >
          Agenda de Citas
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Agendar y consultar citas programadas (pre-registro en línea)
        </p>
      </div>

      {!isVisitante ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-xs hover:underline"
            style={{ color: "#60a5fa" }}
          >
            ← Volver a Gestión de Visitantes
          </button>
        </div>
      ) : null}
    </div>
  );
}