// src/components/VideoRecorder.jsx
import React, { useEffect, useRef, useState } from "react";

export default function VideoRecorder({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const chunksRef = useRef([]);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: true,
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
        console.error("[VideoRecorder] getUserMedia error:", err);
        alert("No se pudo acceder a la cámara/micrófono.");
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

  const startRecording = () => {
    if (!stream) return;
    const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const dataUrl = await blobToBase64(blob);
      onCapture?.(dataUrl);
    };

    mr.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
    onClose?.();
  };

  const handleCancel = () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 text-white text-sm">
        <span className="font-semibold">Grabar video — SENAF</span>
        <button
          onClick={handleCancel}
          className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
        >
          Cerrar
        </button>
      </div>

      {/* Área de video full screen */}
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
          {!recording ? (
            <button
              onClick={startRecording}
              className="px-6 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg"
            >
              ● Iniciar grabación
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-6 py-2 rounded-full bg-green-500 hover:bg-green-400 text-white font-semibold text-sm shadow-lg"
            >
              ■ Detener y guardar
            </button>
          )}

          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
