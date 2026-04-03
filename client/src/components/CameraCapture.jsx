import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

export default function CameraCapture({ onCapture, onClose }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    let active = true;
    let localStream = null;

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
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
        console.error("[CameraCapture] getUserMedia error:", err);
        alert(t("camera.errors.noAccess"));
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
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          {t("camera.title")}
        </span>

        <button
          onClick={handleClose}
          className="px-3 py-1 rounded-full text-xs transition"
          style={sxGhostBtn({
            borderRadius: "9999px",
          })}
        >
          {t("actions.close")}
        </button>
      </div>

      {/* Área de cámara full screen */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4">
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
            {t("camera.rotate")}
          </button>
        </div>

        <p
          className="mt-3 max-w-md text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {t("camera.instructions")}
        </p>

        {/* Controles */}
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={takePhoto}
            className="px-6 py-2 rounded-full font-semibold text-sm transition"
            style={sxPrimaryBtn({
              borderRadius: "9999px",
            })}
          >
            {t("camera.capture")}
          </button>

          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-full text-xs transition"
            style={sxGhostBtn({
              borderRadius: "9999px",
            })}
          >
            {t("actions.cancel")}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}