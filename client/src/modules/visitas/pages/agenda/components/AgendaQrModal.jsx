import React from "react";
import { sxCard, sxCardSoft, sxGhostBtn, sxPrimaryBtn } from "../styles.js";

function safeText(value) {
  return String(value || "").trim();
}

function formatFecha(citaAt) {
  if (!citaAt) return "";
  const d = new Date(citaAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-HN");
}

function formatHora(citaAt) {
  if (!citaAt) return "";
  const d = new Date(citaAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-HN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildQrFilename(cita) {
  const nombre = safeText(cita?.nombre || "visitante")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

  const documento = safeText(cita?.documento || "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "");

  const fecha = cita?.citaAt
    ? formatFecha(cita.citaAt).replace(/\//g, "-")
    : "";

  return `senaf-qr-${nombre || "cita"}${
    documento ? `-${documento}` : ""
  }${fecha ? `-${fecha}` : ""}.png`;
}

function downloadDataUrl(dataUrl, filename = "senaf-qr-cita.png") {
  if (!dataUrl) return;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function buildCompanionsHtml(acompanantes = []) {
  if (!Array.isArray(acompanantes) || !acompanantes.length) return "";

  const items = acompanantes
    .map((comp) => {
      const nombre = safeText(comp?.nombre);
      const documento = safeText(comp?.documento);
      return `<li>${nombre}${documento ? ` — ${documento}` : ""}</li>`;
    })
    .join("");

  return `
    <div class="section">
      <div class="row"><span class="label">Acompañantes:</span></div>
      <ul class="companions">${items}</ul>
    </div>
  `;
}

function printQrCard({ qrDataUrl, cita }) {
  if (!qrDataUrl) return;

  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;

  const nombre = safeText(cita?.nombre || "Visitante");
  const documento = safeText(cita?.documento || "N/D");
  const empleado = safeText(cita?.empleado || "N/D");
  const motivo = safeText(cita?.motivo || "N/D");
  const fecha = formatFecha(cita?.citaAt) || "N/D";
  const hora = formatHora(cita?.citaAt) || "N/D";
  const companionsHtml = buildCompanionsHtml(cita?.acompanantes || []);

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>QR Cita SENAF</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            background: #ffffff;
          }
          .card {
            max-width: 760px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            padding: 24px;
          }
          .title {
            font-size: 30px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .subtitle {
            font-size: 16px;
            color: #475569;
            margin-bottom: 20px;
            line-height: 1.5;
          }
          .qr-wrap {
            display: flex;
            justify-content: center;
            margin: 18px 0 24px;
          }
          .qr-wrap img {
            width: 300px;
            height: 300px;
            object-fit: contain;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 12px;
            background: #ffffff;
          }
          .details {
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            padding: 18px;
            background: #f8fafc;
          }
          .row {
            margin: 8px 0;
            font-size: 18px;
            line-height: 1.5;
          }
          .label {
            font-weight: 700;
          }
          .section {
            margin-top: 16px;
          }
          .companions {
            margin: 8px 0 0 20px;
            padding: 0;
            font-size: 17px;
            line-height: 1.5;
          }
          @media print {
            body {
              padding: 0;
            }
            .card {
              border: none;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Cita agendada</div>
          <div class="subtitle">
            Presente este código QR al guardia para validar su ingreso.
          </div>

          <div class="qr-wrap">
            <img src="${qrDataUrl}" alt="QR de cita SENAF" />
          </div>

          <div class="details">
            <div class="row"><span class="label">Visitante:</span> ${nombre}</div>
            <div class="row"><span class="label">Documento:</span> ${documento}</div>
            <div class="row"><span class="label">Empleado:</span> ${empleado}</div>
            <div class="row"><span class="label">Motivo:</span> ${motivo}</div>
            <div class="row"><span class="label">Fecha:</span> ${fecha}</div>
            <div class="row"><span class="label">Hora:</span> ${hora}</div>
            ${companionsHtml}
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();

  setTimeout(() => {
    win.print();
  }, 350);
}

export default function AgendaQrModal({ open, qrModal, onClose }) {
  if (!open) return null;

  const cita = qrModal?.cita || null;
  const qrDataUrl = qrModal?.qrDataUrl || "";
  const fecha = formatFecha(cita?.citaAt);
  const hora = formatHora(cita?.citaAt);
  const filename = buildQrFilename(cita);

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
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
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
            <strong>Visitante:</strong> {cita?.nombre || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Documento:</strong> {cita?.documento || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Empleado:</strong> {cita?.empleado || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Motivo:</strong> {cita?.motivo || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Fecha:</strong> {fecha}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Hora:</strong> {hora}
          </div>

          {!!cita?.acompanantes?.length && (
            <div className="mt-2" style={{ color: "var(--text)" }}>
              <strong>Acompañantes:</strong>
              <ul className="mt-1 list-disc pl-5">
                {cita.acompanantes.map((comp, idx) => (
                  <li key={`qr-comp-${idx}`}>
                    {comp?.nombre || ""} {comp?.documento ? `— ${comp.documento}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={() => downloadDataUrl(qrDataUrl, filename)}
            disabled={!qrDataUrl}
            className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-50"
            style={sxGhostBtn()}
            title="Descargar QR"
          >
            Descargar QR
          </button>

          <button
            type="button"
            onClick={() => printQrCard({ qrDataUrl, cita })}
            disabled={!qrDataUrl}
            className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-50"
            style={sxGhostBtn()}
            title="Imprimir QR"
          >
            Imprimir
          </button>

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