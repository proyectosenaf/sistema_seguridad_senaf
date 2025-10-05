import React, { useEffect, useMemo, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

/**
 * Props:
 * - onRead(payload)        -> JSON del QR o { raw: string } si no es JSON
 * - onError?(errMsg)       -> opcional, errores de cámara/lectura
 * - onReady?()             -> opcional, cuando el scanner está montado
 * - fps?                   -> default 10
 * - qrbox?                 -> número (px) o { width, height }; default 250
 * - once?                  -> si true, detiene el scanner al primer acierto
 */
export default function RondasQRScanner({
  onRead,
  onError,
  onReady,
  fps = 10,
  qrbox = 250,
  once = false,
}) {
  // id estable para el contenedor
  const containerId = useMemo(
    () => `rondas-qr-box-${Math.random().toString(36).slice(2)}`,
    []
  );

  const scannerRef = useRef(null);
  const mountedRef = useRef(false);
  const cbsRef = useRef({ onRead, onError, onReady, once });
  const [error, setError] = useState(null);

  // Mantener callbacks actuales sin re-montar el scanner
  useEffect(() => {
    cbsRef.current = { onRead, onError, onReady, once };
  }, [onRead, onError, onReady, once]);

  useEffect(() => {
    // Evita SSR y problemas en entornos sin DOM
    if (typeof window === "undefined") return;

    const el = document.getElementById(containerId);
    if (!el || mountedRef.current) return;

    const box =
      typeof qrbox === "number" ? { width: qrbox, height: qrbox } : qrbox;

    const scanner = new Html5QrcodeScanner(
      containerId,
      { fps, qrbox: box },
      /* verbose */ false
    );
    scannerRef.current = scanner;
    mountedRef.current = true;

    let disposed = false;

    const onSuccess = (decodedText /*, decodedResult */) => {
      if (disposed) return;
      try {
        const payload = JSON.parse(decodedText);
        cbsRef.current.onRead?.(payload);
      } catch {
        cbsRef.current.onRead?.({ raw: decodedText });
      }
      if (cbsRef.current.once) {
        // Detener tras la primera lectura exitosa
        disposed = true;
        scannerRef.current
          ?.clear()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            mountedRef.current = false;
          });
      }
    };

    const onFailure = (err) => {
      const s = String(err || "");
      // Mensaje claro cuando no hay permisos
      if (s.includes("NotAllowedError")) {
        const msg =
          "Permiso de cámara denegado. Habilítalo en el navegador para escanear.";
        setError(msg);
        cbsRef.current.onError?.(msg);
      }
      // Otros errores de decodificación se silencian para no spamear la UI.
    };

    scanner.render(onSuccess, onFailure);
    cbsRef.current.onReady?.();

    return () => {
      disposed = true;
      const inst = scannerRef.current || scanner;
      scannerRef.current = null;
      mountedRef.current = false;
      inst?.clear?.().catch(() => {});
    };
    // ⚠️ Importante: no dependemos de onRead/onError/onReady/once gracias a cbsRef
  }, [containerId, fps, qrbox]);

  const handleManual = () => {
    const input = prompt("Payload del QR (dev)");
    if (!input) return;
    try {
      cbsRef.current.onRead?.(JSON.parse(input));
    } catch {
      cbsRef.current.onRead?.({ raw: input });
    }
  };

  return (
    <div className="space-y-2">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div
        id={containerId}
        className="w-full rounded-xl border border-neutral-800 min-h-[280px]"
      />
      {/* Fallback manual en desarrollo */}
      <button
        type="button"
        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 hover:border-neutral-500"
        onClick={handleManual}
      >
        Probar QR manual
      </button>
    </div>
  );
}
