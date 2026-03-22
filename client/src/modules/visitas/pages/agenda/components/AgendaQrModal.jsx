import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { sxCard, sxCardSoft, sxGhostBtn, sxPrimaryBtn } from "../styles.js";

function safeText(value) {
  return String(value || "").trim();
}

function normalizeEstadoValue(value) {
  const raw = String(value || "").trim();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw.toLowerCase()] || raw || "Programada";
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

  const fecha = cita?.citaAt ? formatFecha(cita.citaAt).replace(/\//g, "-") : "";

  return `senaf-qr-${nombre || "cita"}${
    documento ? `-${documento}` : ""
  }${fecha ? `-${fecha}` : ""}.png`;
}

async function resolveQrDataUrl(qrDataUrl, qrPayload) {
  if (qrDataUrl && String(qrDataUrl).trim()) {
    return String(qrDataUrl).trim();
  }

  const payload = String(qrPayload || "").trim();
  if (!payload) return "";

  try {
    return await QRCode.toDataURL(payload, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("[AgendaQrModal] No se pudo generar QR:", err);
    return "";
  }
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

function printQrCard({ qrDataUrl, cita }) {
  if (!qrDataUrl) return;

  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;

  const nombre = safeText(cita?.nombre || "Visitante");
  const empleado = safeText(cita?.empleado || "N/D");
  const fecha = formatFecha(cita?.citaAt) || "N/D";
  const hora = formatHora(cita?.citaAt) || "N/D";

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>QR Cita SENAF</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #ffffff; }
          .card { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 20px; padding: 24px; }
          .title { font-size: 30px; font-weight: 700; margin-bottom: 8px; }
          .subtitle { font-size: 16px; color: #475569; margin-bottom: 20px; line-height: 1.5; }
          .qr-wrap { display: flex; justify-content: center; margin: 18px 0 24px; }
          .qr-wrap img { width: 300px; height: 300px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 18px; padding: 12px; background: #ffffff; }
          .details { border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px; background: #f8fafc; }
          .row { margin: 8px 0; font-size: 18px; line-height: 1.5; }
          .label { font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Cita autorizada</div>
          <div class="subtitle">Presente este código QR al guardia para validar su ingreso.</div>
          <div class="qr-wrap">
            <img src="${qrDataUrl}" alt="QR de cita SENAF" />
          </div>
          <div class="details">
            <div class="row"><span class="label">Visitante:</span> ${nombre}</div>
            <div class="row"><span class="label">Empleado:</span> ${empleado}</div>
            <div class="row"><span class="label">Fecha:</span> ${fecha}</div>
            <div class="row"><span class="label">Hora:</span> ${hora}</div>
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

function getStatusMessage(estado) {
  const normalized = normalizeEstadoValue(estado);

  switch (normalized) {
    case "Autorizada":
      return "Tu cita fue autorizada. Presenta este código QR al guardia.";
    case "Denegada":
      return "La cita fue denegada. No se generará código QR.";
    case "Cancelada":
      return "La cita fue cancelada. No se generará código QR.";
    case "Dentro":
      return "La visita ya fue registrada como ingresada.";
    case "Finalizada":
      return "La visita ya fue finalizada.";
    case "En revisión":
      return "Tu solicitud está en revisión. Una vez autorizada, se generará el código QR.";
    case "Programada":
    default:
      return "Una vez autorizada esta agenda, se generará el código QR.";
  }
}

export default function AgendaQrModal({ open, qrModal, onClose }) {
  const cita = qrModal?.cita || null;
  const qrPayload = qrModal?.qrPayload || "";
  const serverQrDataUrl = qrModal?.qrDataUrl || "";
  const estado = normalizeEstadoValue(cita?.estado || "Programada");
  const isAutorizada = estado === "Autorizada";

  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState("");
  const [generatingQr, setGeneratingQr] = useState(false);

  const finalQrDataUrl = useMemo(() => {
    if (!isAutorizada) return "";
    return serverQrDataUrl || generatedQrDataUrl || "";
  }, [serverQrDataUrl, generatedQrDataUrl, isAutorizada]);

  useEffect(() => {
    let cancelled = false;

    async function syncQrImage() {
      if (!open) return;

      if (!isAutorizada) {
        setGeneratedQrDataUrl("");
        setGeneratingQr(false);
        return;
      }

      try {
        setGeneratingQr(true);
        const dataUrl = await resolveQrDataUrl(serverQrDataUrl, qrPayload);
        if (!cancelled) {
          setGeneratedQrDataUrl(dataUrl);
        }
      } finally {
        if (!cancelled) {
          setGeneratingQr(false);
        }
      }
    }

    syncQrImage();

    return () => {
      cancelled = true;
    };
  }, [open, qrPayload, serverQrDataUrl, isAutorizada]);

  if (!open) return null;

  const fecha = formatFecha(cita?.citaAt);
  const hora = formatHora(cita?.citaAt);
  const filename = buildQrFilename(cita);
  const statusMessage = getStatusMessage(estado);

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
              {isAutorizada ? "Tu QR de cita" : "Estado de la cita"}
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {statusMessage}
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
          {isAutorizada ? (
            finalQrDataUrl ? (
              <img
                src={finalQrDataUrl}
                alt="QR de la cita"
                className="h-64 w-64 rounded-xl bg-white p-3 object-contain"
              />
            ) : generatingQr ? (
              <div
                className="h-64 w-64 rounded-xl flex items-center justify-center text-center text-sm p-4"
                style={sxCardSoft({ color: "var(--text-muted)" })}
              >
                Generando imagen QR...
              </div>
            ) : (
              <div
                className="h-64 w-64 rounded-xl flex items-center justify-center text-center text-sm p-4"
                style={sxCardSoft({ color: "var(--text-muted)" })}
              >
                No se pudo generar el código QR.
              </div>
            )
          ) : (
            <div
              className="h-64 w-64 rounded-xl flex items-center justify-center text-center text-sm p-6"
              style={sxCardSoft({ color: "var(--text-muted)" })}
            >
              {statusMessage}
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
            <strong>Empleado:</strong> {cita?.empleado || ""}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Fecha:</strong> {fecha}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Hora:</strong> {hora}
          </div>
          <div style={{ color: "var(--text)" }}>
            <strong>Estado:</strong> {estado}
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
          {isAutorizada && (
            <>
              <button
                type="button"
                onClick={() => downloadDataUrl(finalQrDataUrl, filename)}
                disabled={!finalQrDataUrl}
                className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-50"
                style={sxGhostBtn()}
                title="Descargar QR"
              >
                Descargar QR
              </button>

              <button
                type="button"
                onClick={() => printQrCard({ qrDataUrl: finalQrDataUrl, cita })}
                disabled={!finalQrDataUrl}
                className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-50"
                style={sxGhostBtn()}
                title="Imprimir QR"
              >
                Imprimir
              </button>
            </>
          )}

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