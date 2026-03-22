import React from "react";
import { sxCard, sxCardSoft, sxGhostBtn, sxPrimaryBtn } from "../styles.js";

export default function AgendaQrModal({ open, qrModal, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-[24px] p-5 md:p-6"
        style={sxCard({
          background:
            "color-mix(in srgb, var(--card-solid) 96%, rgba(2,6,23,.88))",
        })}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--text)" }}
            >
              Cita agendada
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Presente este código QR al guardia para validar su ingreso.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm"
            style={sxGhostBtn()}
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          {qrModal.qrDataUrl ? (
            <img
              src={qrModal.qrDataUrl}
              alt="QR de la cita"
              className="h-64 w-64 rounded-xl bg-white p-3 object-contain"
            />
          ) : (
            <div
              className="h-64 w-64 rounded-xl flex items-center justify-center text-center text-sm p-4"
              style={sxCardSoft({ color: "var(--text-muted)" })}
            >
              No se recibió imagen QR del servidor.
            </div>
          )}
        </div>

        <div
          className="mt-4 rounded-xl p-4 text-sm"
          style={sxCardSoft({ background: "var(--input-bg)" })}
        >
          <div style={{ color: "var(--text)" }}>
            <strong>Visitante:</strong> {qrModal.cita?.nombre || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Documento:</strong> {qrModal.cita?.documento || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Empleado:</strong> {qrModal.cita?.empleado || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Motivo:</strong> {qrModal.cita?.motivo || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Fecha:</strong>{" "}
            {qrModal.cita?.citaAt
              ? new Date(qrModal.cita.citaAt).toLocaleDateString("es-HN")
              : ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Hora:</strong>{" "}
            {qrModal.cita?.citaAt
              ? new Date(qrModal.cita.citaAt).toLocaleTimeString("es-HN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </div>

          {!!qrModal.cita?.acompanantes?.length && (
            <div className="mt-2" style={{ color: "var(--text)" }}>
              <strong>Acompañantes:</strong>
              <ul className="mt-1 list-disc pl-5">
                {qrModal.cita.acompanantes.map((comp, idx) => (
                  <li key={`qr-comp-${idx}`}>
                    {comp.nombre} — {comp.documento}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md text-xs font-semibold transition"
            style={sxPrimaryBtn()}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
