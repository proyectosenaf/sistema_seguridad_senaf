// src/components/CameraCapture.jsx
import React, { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("[CameraCapture] getUserMedia error:", err);
        alert("No se pudo acceder a la cámara.");
        onClose?.();
      }
    }

    init();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 720;
    const h = video.videoHeight || 1280;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    if (rotated) {
      // si está rotado, dibujamos rotando el contexto
      canvas.width = h;
      canvas.height = w;
      ctx.translate(h / 2, w / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(video, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture?.(dataUrl);
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 text-white text-sm">
        <span className="font-semibold">Tomar foto — SENAF</span>
        <button
          onClick={handleClose}
          className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
        >
          Cerrar
        </button>
      </div>

      {/* Área de cámara full screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
        <div className="relative w-full max-w-3xl aspect-[9/16] md:aspect-video bg-black overflow-hidden rounded-2xl border border-white/10">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-contain transition-transform duration-300 ${
              rotated ? "rotate-90" : ""
            }`}
          />
          <button
            type="button"
            onClick={() => setRotated((r) => !r)}
            className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full hover:bg-black/80"
          >
            ↻ Rotar
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-300 text-center max-w-md">
          Gire el dispositivo para modo vertical u horizontal. Use el botón
          “Rotar” si la imagen se ve invertida.
        </p>

        {/* Controles */}
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={takePhoto}
            className="px-6 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm shadow-lg"
          >
            📷 Capturar foto
          </button>

          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs"
          >
            Cancelar
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
