import React, { useEffect, useMemo, useState } from "react";

/**
 * Muestra un QR en un modal y permite descargarlo en PNG.
 *
 * Props:
 *  - open: boolean
 *  - onClose(): void
 *  - qr?: {
 *      dataUrl?: string;   // "data:image/png;base64,..."
 *      url?: string;       // URL http(s) o blob: del PNG
 *      filename?: string;  // nombre sugerido
 *      payload?: any;      // opcional, contenido del QR para copiar
 *    }
 *  - title?: string
 */
export default function RondasQRModal({ open, onClose, qr, title = "Código QR" }) {
  const [blobUrl, setBlobUrl] = useState("");

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Si solo viene "url", intentamos hacerla descargable:
  // - Si es data: o blob: o misma-origen -> ya sirve para download
  // - Si es cross-origin y el servidor permite CORS, la convertimos a blob:
  useEffect(() => {
    let revoke = "";
    async function makeDownloadable() {
      setBlobUrl("");
      if (!open) return;
      if (qr?.dataUrl) return;               // ya descargable
      if (!qr?.url) return;

      const u = qr.url;
      if (u.startsWith("data:") || u.startsWith("blob:")) return; // ya descargable
      if (u.startsWith(window.location.origin)) {
        // misma-origen -> el atributo download funciona
        return;
      }
      // Intento de fetch (si CORS lo permite) para ofrecer download como blob
      try {
        const res = await fetch(u, { credentials: "include" });
        if (!res.ok) return;
        const b = await res.blob();
        const local = URL.createObjectURL(b);
        revoke = local;
        setBlobUrl(local);
      } catch {
        // silencio: si falla, dejamos el botón "Abrir en pestaña"
      }
    }
    makeDownloadable();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
      setBlobUrl("");
    };
  }, [open, qr?.url, qr?.dataUrl]);

  if (!open) return null;

  const fileName = qr?.filename || "checkpoint.png";
  const imgSrc = qr?.dataUrl || blobUrl || qr?.url || "";

  // ¿Podemos usar <a download>?
  const canDownload = useMemo(() => {
    if (qr?.dataUrl?.startsWith("data:image")) return true;
    if (blobUrl) return true;                       // blob obtenido por fetch
    if (qr?.url?.startsWith("blob:")) return true; // blob pasado desde fuera
    if (qr?.url?.startsWith(window.location.origin)) return true; // misma-origen
    return false;
  }, [qr?.dataUrl, qr?.url, blobUrl]);

  const downloadHref = qr?.dataUrl || blobUrl || qr?.url || "";

  const payloadText = qr?.payload
    ? (typeof qr.payload === "string" ? qr.payload : JSON.stringify(qr.payload, null, 2))
    : "";

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copiado al portapapeles");
    } catch {
      // Fallback accesible
      // eslint-disable-next-line no-alert
      window.prompt("Copia manualmente:", text);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
          >
            Cerrar
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {!imgSrc ? (
            <div className="text-neutral-400 text-sm">Generando QR…</div>
          ) : (
            <img
              src={imgSrc}
              alt="Código QR"
              className="w-64 h-64 mx-auto rounded-lg border border-neutral-800 bg-neutral-950 object-contain"
            />
          )}

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2">
            {canDownload && imgSrc ? (
              <a
                href={downloadHref}
                download={fileName}
                className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500"
              >
                Descargar PNG
              </a>
            ) : imgSrc ? (
              <a
                href={imgSrc}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500"
              >
                Abrir en pestaña
              </a>
            ) : null}

            {payloadText && (
              <button
                type="button"
                onClick={() => copyText(payloadText)}
                className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500"
              >
                Copiar payload
              </button>
            )}
          </div>

          {payloadText && (
            <pre className="text-xs text-neutral-300/90 bg-neutral-950 border border-neutral-800 rounded-lg p-3 overflow-auto max-h-40">
              {payloadText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
