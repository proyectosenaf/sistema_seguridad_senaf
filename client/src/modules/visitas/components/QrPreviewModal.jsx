import React from "react";
import { QRCodeSVG } from "qrcode.react";
import CitaEstadoPill from "../pages/agenda/components/CitaEstadoPill.jsx";
import {
  downloadQrCita,
  printQrCita,
  getRenderableQrValue,
  normalizeCitaEstado,
} from "../utils/helpers.js";
import {
  sxCard,
  sxCardSoft,
  sxGhostBtn,
  sxPrimaryBtn,
  sxSuccessBtn,
} from "../styles/styles.js";

export default function QrPreviewModal({
  qrCita,
  isVisitor,
  savingCitaAction,
  setQrCita,
  handleRegistrarIngreso,
}) {
  if (!qrCita) return null;

  const qrModalValue = getRenderableQrValue(qrCita);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(2, 6, 23, 0.62)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setQrCita(null);
      }}
    >
      <div
        className="p-4 md:p-6 w-[95%] max-w-[520px] rounded-[24px]"
        style={sxCard()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--text)" }}
            >
              {isVisitor ? "Tu QR de cita" : "Validación de cita"}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isVisitor
                ? "Muéstralo o descárgalo para presentarlo al guardia."
                : "Verifica la información antes de registrar el ingreso."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQrCita(null)}
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            className="rounded-[18px] p-4"
            style={sxCardSoft({ background: "#ffffff" })}
          >
            {qrCita.qrDataUrl ? (
              <img
                src={qrCita.qrDataUrl}
                alt="QR de cita"
                className="w-[220px] h-[220px] object-contain"
              />
            ) : qrModalValue ? (
              <QRCodeSVG value={qrModalValue} size={220} includeMargin />
            ) : (
              <div
                className="w-[220px] h-[220px] flex items-center justify-center text-center text-xs rounded-[12px]"
                style={{
                  color: "#334155",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                No hay QR disponible
              </div>
            )}
          </div>

          <div
            className="w-full rounded-[18px] p-4 text-sm"
            style={sxCardSoft({ background: "var(--input-bg)" })}
          >
            <div style={{ color: "var(--text)" }}>
              <strong>Visitante:</strong> {qrCita.nombre || qrCita.visitante || "—"}
            </div>

            {!isVisitor && (
              <div style={{ color: "var(--text)" }}>
                <strong>Documento:</strong> {qrCita.documento || "—"}
              </div>
            )}

            <div style={{ color: "var(--text)" }}>
              <strong>Empleado:</strong> {qrCita.empleado || "—"}
            </div>

            {!isVisitor && (
              <div style={{ color: "var(--text)" }}>
                <strong>Motivo:</strong> {qrCita.motivo || "—"}
              </div>
            )}

            <div style={{ color: "var(--text)" }}>
              <strong>Fecha:</strong>{" "}
              {qrCita.citaAt instanceof Date &&
              !Number.isNaN(qrCita.citaAt.getTime())
                ? qrCita.citaAt.toLocaleDateString("es-HN")
                : qrCita.fecha || "—"}
            </div>

            <div style={{ color: "var(--text)" }}>
              <strong>Hora:</strong>{" "}
              {qrCita.citaAt instanceof Date &&
              !Number.isNaN(qrCita.citaAt.getTime())
                ? qrCita.citaAt.toLocaleTimeString("es-HN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : qrCita.hora || "—"}
            </div>

            {!isVisitor && (
              <>
                <div className="mt-1" style={{ color: "var(--text)" }}>
                  <strong>Estado:</strong> <CitaEstadoPill estado={qrCita.estado} />
                </div>

                {!!qrCita.empresa && (
                  <div style={{ color: "var(--text)" }}>
                    <strong>Empresa:</strong> {qrCita.empresa}
                  </div>
                )}

                {!!qrCita.telefono && (
                  <div style={{ color: "var(--text)" }}>
                    <strong>Teléfono:</strong> {qrCita.telefono}
                  </div>
                )}

                {!!qrCita.correo && (
                  <div style={{ color: "var(--text)" }}>
                    <strong>Correo:</strong> {qrCita.correo}
                  </div>
                )}

                {!!qrCita.vehiculo && (
                  <div className="mt-2" style={{ color: "var(--text)" }}>
                    <strong>Vehículo:</strong>{" "}
                    {[
                      qrCita.vehiculo?.marca,
                      qrCita.vehiculo?.modelo,
                      qrCita.vehiculo?.placa
                        ? `(${qrCita.vehiculo.placa})`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                )}

                {!!qrCita?.acompanantes?.length && (
                  <div className="mt-2" style={{ color: "var(--text)" }}>
                    <strong>Acompañantes:</strong>
                    <ul className="mt-1 list-disc pl-5">
                      {qrCita.acompanantes.map((comp, idx) => (
                        <li key={`qr-comp-${idx}`}>
                          {comp?.nombre || ""}{" "}
                          {comp?.documento ? `— ${comp.documento}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={() => downloadQrCita(qrCita)}
            className="px-3 py-2 rounded-md text-xs font-semibold transition"
            style={sxGhostBtn()}
          >
            Descargar QR
          </button>

          <button
            type="button"
            onClick={() => printQrCita(qrCita)}
            className="px-3 py-2 rounded-md text-xs font-semibold transition"
            style={sxGhostBtn()}
          >
            Imprimir
          </button>

          {!isVisitor &&
            ["Programada", "En revisión", "Autorizada"].includes(
              normalizeCitaEstado(qrCita?.estado)
            ) && (
              <button
                type="button"
                onClick={() => handleRegistrarIngreso(qrCita)}
                disabled={savingCitaAction === `${qrCita._id}:checkin`}
                className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-60"
                style={sxSuccessBtn()}
              >
                {savingCitaAction === `${qrCita._id}:checkin`
                  ? "Registrando..."
                  : "Registrar ingreso"}
              </button>
            )}

          <button
            type="button"
            onClick={() => setQrCita(null)}
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