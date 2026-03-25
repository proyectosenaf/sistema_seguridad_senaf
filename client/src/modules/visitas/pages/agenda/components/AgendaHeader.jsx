import React from "react";

export default function AgendaHeader({ isVisitante = false, onBack }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header principal */}
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

      {/* Aviso */}
      <div
        className="max-w-[720px] rounded-xl px-3 py-2.5"
        style={{
          background:
            "linear-gradient(180deg, rgba(251,191,36,0.08), rgba(251,191,36,0.04))",
          border: "1px solid rgba(251,191,36,0.16)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              color: "#fbbf24",
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.18)",
            }}
          >
            !
          </div>

          <div>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "#fbbf24" }}
            >
              Aviso importante
            </div>

            <p
              className="mt-0.5 text-xs md:text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Las citas están sujetas a cambios de fecha y hora según
              disponibilidad, aprobación administrativa o razones de seguridad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}