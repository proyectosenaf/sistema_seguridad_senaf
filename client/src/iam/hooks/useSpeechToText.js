import { useEffect, useRef, useState, useCallback } from "react";

export default function useSpeechToText({ lang = "es-ES", continuous = true } = {}) {
  const recogRef = useRef(null);

  // texto confirmado (final) y lo que va "en vivo" (interim)
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");

  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);

  // guardamos el último final para evitar duplicados raros
  const lastFinalRef = useRef("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }

    const r = new SR();
    r.lang = lang;
    r.continuous = continuous;
    r.interimResults = true;

    r.onstart = () => {
      setError(null);
      setListening(true);
    };

    r.onend = () => {
      setListening(false);
      setInterimText("");
    };

    r.onerror = (e) => {
      setError(e?.error || "speech_error");
      setListening(false);
    };

    r.onresult = (event) => {
      // IMPORTANTE: solo procesar desde event.resultIndex (NO todo results)
      let newFinal = "";
      let newInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = (res[0]?.transcript || "").trim();

        if (!text) continue;

        if (res.isFinal) {
          newFinal += (newFinal ? " " : "") + text;
        } else {
          newInterim += (newInterim ? " " : "") + text;
        }
      }

      // Si llega final duplicado (a veces el motor lo re-emite), lo ignoramos
      if (newFinal) {
        const normalized = newFinal.replace(/\s+/g, " ").trim();
        if (normalized && normalized !== lastFinalRef.current) {
          lastFinalRef.current = normalized;
          setFinalText((prev) => (prev ? prev + " " + normalized : normalized));
        }
        setInterimText(""); // al confirmar, limpiamos interim
      } else {
        setInterimText(newInterim);
      }
    };

    recogRef.current = r;

    return () => {
      try {
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.onstart = null;
        r.stop();
      } catch {}
      recogRef.current = null;
    };
  }, [lang, continuous]);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    setError(null);
    try {
      // evitar "InvalidStateError" si ya está escuchando
      if (!listening) recogRef.current.start();
    } catch {}
  }, [listening]);

  const stop = useCallback(() => {
    if (!recogRef.current) return;
    try {
      recogRef.current.stop();
    } catch {}
  }, []);

  // ✅ Limpieza real: detener y resetear buffers internos
  const reset = useCallback(() => {
    lastFinalRef.current = "";
    setFinalText("");
    setInterimText("");
    setError(null);

    // detener y “reiniciar” recognition
    if (recogRef.current) {
      try {
        recogRef.current.abort(); // abort es mejor que stop para cortar resultados pendientes
      } catch {}
    }
  }, []);

  return {
    supported,
    listening,
    error,
    finalText,
    interimText,
    transcript: (finalText + (interimText ? " " + interimText : "")).trim(),
    start,
    stop,
    reset,
  };
}
