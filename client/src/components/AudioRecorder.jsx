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
    if (status === "recording") t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => t && clearInterval(t);
  }, [status]);

  async function start() {
    setErr("");
    setSeconds(0);
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
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus("ready");
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
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1220]/90 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Grabar audio</h3>
          <button onClick={cancel} className="text-white/70 hover:text-white">✕</button>
        </div>

        {err ? <div className="text-sm text-rose-200 mb-2">{err}</div> : null}

        <div className="text-sm text-white/70 mb-3">
          Estado: <span className="text-white">{status}</span>
          {status === "recording" ? <span className="ml-2">⏺️ {seconds}s</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {status !== "recording" ? (
            <button
              type="button"
              onClick={start}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
            >
              🎙️ Iniciar
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500"
            >
              ⏹️ Detener
            </button>
          )}

          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 border border-white/10"
          >
            Cancelar
          </button>

          {status === "ready" ? (
            <button
              type="button"
              onClick={save}
              className="ml-auto px-4 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500"
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
