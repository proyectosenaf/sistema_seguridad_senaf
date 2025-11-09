import React, { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("No se pudo acceder a la cámara", err);
        setError("No se pudo acceder a la cámara.");
      }
    })();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleTakePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture?.(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#0f1b2d] border border-cyan-400/30 rounded-lg p-4 w-full max-w-md space-y-3">
        <h3 className="text-white font-semibold text-sm">Cámara</h3>
        {error ? (
          <p className="text-red-300 text-xs">{error}</p>
        ) : (
          <video
            ref={videoRef}
            className="w-full rounded bg-black aspect-video object-contain"
            autoPlay
            muted
            playsInline
          />
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs rounded bg-slate-600/50 hover:bg-slate-500"
          >
            Cerrar
          </button>
          <button
            onClick={handleTakePhoto}
            className="px-3 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500"
          >
            Tomar foto
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
