import React from "react";

function pickMime() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

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

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
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

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #0891b2, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #0891b2 22%, transparent)",
    ...extra,
  };
}

export default function AudioRecorder({ onCapture, onClose }) {
  const [status, setStatus] = React.useState("idle"); // idle | recording | ready | error
  const [err, setErr] = React.useState("");
  const [audioUrl, setAudioUrl] = React.useState("");
  const [seconds, setSeconds] = React.useState(0);

  const streamRef = React.useRef(null);
  const recRef = React.useRef(null);
  const chunksRef = React.useRef([]);

  React.useEffect(() => {
    let t = null;
    if (status === "recording") {
      t = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => t && clearInterval(t);
  }, [status]);

  React.useEffect(() => {
    return () => {
      try {
        if (recRef.current?.state === "recording") recRef.current.stop();
      } catch {}
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      try {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      } catch {}
    };
  }, [audioUrl]);

  async function start() {
    setErr("");
    setSeconds(0);

    try {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    } catch {}

    setAudioUrl("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, {
            type: rec.mimeType || "audio/webm",
          });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          setStatus("ready");
        } catch {
          setErr("No se pudo preparar la previsualización del audio.");
          setStatus("error");
        }
      };

      rec.start(250);
      setStatus("recording");
    } catch (e) {
      setErr("Permiso de micrófono denegado o no disponible.");
      setStatus("error");
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {}
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
  }

  async function save() {
    try {
      const mime = recRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      const base64 = await blobToBase64(blob);
      onCapture?.({ base64, mime, seconds });
      onClose?.();
    } catch {
      setErr("No se pudo convertir el audio.");
      setStatus("error");
    }
  }

  function cancel() {
    try {
      if (recRef.current?.state === "recording") recRef.current.stop();
    } catch {}
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    } catch {}
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 6, 23, 0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        className="w-full max-w-lg rounded-[24px] p-5"
        style={sxCard()}
      >
        <div
          className="mb-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}
        >
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--text)" }}
          >
            Grabar audio
          </h3>

          <button
            onClick={cancel}
            className="transition"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        {err ? (
          <div
            className="mb-2 text-sm"
            style={{ color: "#fecdd3" }}
          >
            {err}
          </div>
        ) : null}

        <div
          className="mb-3 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Estado: <span style={{ color: "var(--text)" }}>{status}</span>
          {status === "recording" ? (
            <span className="ml-2">⏺️ {seconds}s</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {status !== "recording" ? (
            <button
              type="button"
              onClick={start}
              className="px-4 py-2 rounded-[14px] transition"
              style={sxSuccessBtn()}
            >
              🎙️ Iniciar
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 rounded-[14px] transition"
              style={sxDangerBtn()}
            >
              ⏹️ Detener
            </button>
          )}

          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 rounded-[14px] transition"
            style={sxGhostBtn()}
          >
            Cancelar
          </button>

          {status === "ready" ? (
            <button
              type="button"
              onClick={save}
              className="ml-auto px-4 py-2 rounded-[14px] transition"
              style={sxPrimaryBtn()}
            >
              ✅ Guardar audio
            </button>
          ) : null}
        </div>

        {audioUrl ? (
          <div className="mt-4">
            <audio src={audioUrl} controls className="w-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}