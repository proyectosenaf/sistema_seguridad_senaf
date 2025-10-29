import React from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

/**
 * QrScanner
 * - Abre la cámara (trasera si existe)
 * - Lee QR/Code128/etc. con ZXing
 * - onResult(text) cuando decodifica
 * - onError(err) ante errores (permiso, cam ocupada, etc.)
 * - Soporta: torch/linterna (si el hardware lo permite), cambiar cámara
 */
export default function QrScanner({
  onResult,
  onError,
  facingMode = "environment", // "user" para frontal
  constraints = {},
  className = "",
  once = true, // si true, se detiene al primer resultado
  enableTorch = true,
  enableFlip = true,
}) {
  const videoRef = React.useRef(null);
  const codeReaderRef = React.useRef(null);
  const controlsRef = React.useRef(null);
  const [status, setStatus] = React.useState("init"); // init | starting | running | error | stopped
  const [errMsg, setErrMsg] = React.useState("");
  const [devices, setDevices] = React.useState([]);
  const [deviceId, setDeviceId] = React.useState(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [canTorch, setCanTorch] = React.useState(false);

  // Beep corto por WebAudio
  const beep = React.useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 120);
    } catch {}
    try { navigator.vibrate?.(80); } catch {}
  }, []);

  // Enumerar cámaras
  const refreshDevices = React.useCallback(async () => {
    try {
      const list = await BrowserMultiFormatReader.listVideoInputDevices();
      setDevices(list || []);
      if (!list || !list.length) return;

      // Elegir cámara por facingMode si hay indicio
      if (!deviceId) {
        if (facingMode === "environment") {
          const back =
            list.find((d) => /back|rear|trás|environment/i.test(`${d.label}`)) ||
            list.find((d) => /facing back/i.test(`${d.label}`));
          setDeviceId(back?.deviceId || list[0].deviceId);
        } else {
          setDeviceId(list[0].deviceId);
        }
      }
    } catch (e) {
      console.warn("[QrScanner] listVideoInputDevices error", e);
    }
  }, [deviceId, facingMode]);

  // Torch (si el track lo permite)
  const applyTorch = React.useCallback(async (on) => {
    try {
      const stream = videoRef.current?.srcObject;
      const track = stream?.getVideoTracks?.()?.[0];
      const caps = track?.getCapabilities?.();
      if (!caps || !caps.torch) {
        setCanTorch(false);
        return false;
      }
      setCanTorch(true);
      await track.applyConstraints({ advanced: [{ torch: !!on }] });
      setTorchOn(!!on);
      return true;
    } catch {
      setCanTorch(false);
      setTorchOn(false);
      return false;
    }
  }, []);

  // Arranque / parada de ZXing
  const stopReader = React.useCallback(() => {
    try { controlsRef.current?.stop(); } catch {}
    try { codeReaderRef.current?.reset(); } catch {}
    const v = videoRef.current;
    const stream = v?.srcObject;
    if (stream && typeof stream.getTracks === "function") {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (v) v.srcObject = null;
    setTorchOn(false);
    setStatus("stopped");
  }, []);

  const startReader = React.useCallback(async (explicitDevice) => {
    stopReader();
    setStatus("starting");
    setErrMsg("");
    try {
      await refreshDevices();

      const selected = explicitDevice || deviceId;
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const vc = selected ? { deviceId: { exact: selected } } : { facingMode };
      const streamConstraints = {
        video: { ...vc, ...constraints },
        audio: false,
      };

      // Creamos stream manual para detectar torch y errores
      const stream = await navigator.mediaDevices.getUserMedia(streamConstraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Chequear soporte de torch
      await applyTorch(torchOn);

      setStatus("running");
      const controls = await codeReader.decodeFromVideoDevice(
        selected || null,
        videoRef.current,
        (result, err, _controls) => {
          controlsRef.current = _controls;
          if (result) {
            const text = String(result.getText());
            beep();
            onResult?.(text);
            if (once) {
              _controls?.stop();
              setStatus("stopped");
              try {
                const st = videoRef.current?.srcObject;
                st?.getTracks?.().forEach((t) => t.stop());
                videoRef.current.srcObject = null;
              } catch {}
            }
          } else if (err) {
            // Errores de frame: ignorar
          }
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      console.warn("[QrScanner] start error", e);
      setStatus("error");
      const msg =
        e?.name === "NotAllowedError"
          ? "El navegador bloqueó el acceso a la cámara. Dale permiso y recarga."
          : e?.name === "NotFoundError"
          ? "No se encontró cámara en el dispositivo."
          : e?.message || "No se pudo iniciar la cámara.";
      setErrMsg(msg);
      onError?.(e);
    }
  }, [applyTorch, beep, constraints, deviceId, facingMode, onError, onResult, once, refreshDevices, stopReader, torchOn]);

  // montar / desmontar
  React.useEffect(() => {
    startReader();
    return () => stopReader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, facingMode]);

  // UI: cambiar dispositivo
  const flipCamera = async () => {
    if (!devices.length) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    setDeviceId(next.deviceId);
    await startReader(next.deviceId);
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover rounded-xl bg-black"
        playsInline
        muted
      />
      {/* Marco */}
      <div className="pointer-events-none absolute inset-0 rounded-xl border-4 border-amber-500" />

      {/* Overlay de estado */}
      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-white/90">
          Iniciando cámara…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center px-4 text-center text-white">
          <div className="max-w-md p-3 rounded-lg bg-black/60">
            <div className="font-semibold mb-1">No se pudo abrir la cámara</div>
            <div className="text-sm opacity-90">{errMsg}</div>
          </div>
        </div>
      )}

      {/* Controles */}
      {(enableTorch || enableFlip) && status === "running" && (
        <div className="absolute right-2 bottom-2 flex gap-2">
          {enableTorch && canTorch && (
            <button
              onClick={() => applyTorch(!torchOn)}
              className="px-3 py-1 rounded-md text-white bg-black/50 hover:bg-black/70 backdrop-blur"
              title="Linterna"
            >
              {torchOn ? "🔦 On" : "🔦 Off"}
            </button>
          )}
          {enableFlip && devices.length > 1 && (
            <button
              onClick={flipCamera}
              className="px-3 py-1 rounded-md text-white bg-black/50 hover:bg-black/70 backdrop-blur"
              title="Cambiar cámara"
            >
              🔁
            </button>
          )}
        </div>
      )}
    </div>
  );
}
