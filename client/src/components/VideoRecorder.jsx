// src/components/VideoRecorder.jsx
import React, { useEffect, useRef, useState } from "react";

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  };
}

export default function VideoRecorder({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const chunksRef = useRef([]);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    let active = true;
    let localStream = null;

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: true,
        });

        localStream = s;

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

      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      } else if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = () => {
    if (!stream) return;

    let mr;
    try {
      mr = new MediaRecorder(stream, { mimeType: "video/webm" });
    } catch {
      mr = new MediaRecorder(stream);
    }

    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mr.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const dataUrl = await blobToBase64(blob);
        onCapture?.(dataUrl);
      } catch (err) {
        console.error("[VideoRecorder] onstop error:", err);
        alert("No se pudo procesar el video grabado.");
      }
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
      setRecording(false);
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Barra superior */}
      <div
        className="flex items-center justify-between px-4 py-3 text-sm"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--panel) 38%, transparent)",
        }}
      >
        <span
          className="font-semibold"
          style={{ color: "var(--text)" }}
        >
          Grabar video — SENAF
        </span>

        <button
          onClick={handleCancel}
          className="px-3 py-1 rounded-full text-xs transition"
          style={sxGhostBtn({
            borderRadius: "9999px",
          })}
        >
          Cerrar
        </button>
      </div>

      {/* Área de video full screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
        <div
          className="relative w-full max-w-3xl aspect-[9/16] md:aspect-video overflow-hidden rounded-[24px]"
          style={sxCard({
            background: "rgba(2, 6, 23, 0.72)",
          })}
        >
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
            className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full transition"
            style={sxGhostBtn({
              borderRadius: "9999px",
            })}
          >
            ↻ Rotar
          </button>
        </div>

        <p
          className="mt-3 max-w-md text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Gire el dispositivo para modo vertical u horizontal. Use el botón
          “Rotar” si la imagen se ve invertida.
        </p>

        {/* Controles */}
        <div className="mt-5 flex items-center gap-4">
          {!recording ? (
            <button
              onClick={startRecording}
              className="px-6 py-2 rounded-full font-semibold text-sm transition"
              style={sxDangerBtn({
                borderRadius: "9999px",
              })}
            >
              ● Iniciar grabación
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-6 py-2 rounded-full font-semibold text-sm transition"
              style={sxSuccessBtn({
                borderRadius: "9999px",
              })}
            >
              ■ Detener y guardar
            </button>
          )}

          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-full text-xs transition"
            style={sxGhostBtn({
              borderRadius: "9999px",
            })}
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