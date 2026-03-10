// client/src/components/GlobalPanicListener.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { subscribeLocalPanic } from "../modules/rondasqr/utils/panicBus.js";
import { useAuth } from "../pages/auth/AuthProvider.jsx";

export default function GlobalPanicListener() {
  const { isAuthenticated } = useAuth();

  const audioRef = useRef(null);
  const [hasAlert, setHasAlert] = useState(false);

  const BEEP_SRC =
    "data:audio/wav;base64,UklGRlCZAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YTmZAACAgICAgICAgICAgP//////AAD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP////8=";

  const triggerAlert = useCallback(() => {
    setHasAlert(true);

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeLocalPanic(() => triggerAlert());
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [triggerAlert]);

  if (!isAuthenticated) return null;

  return (
    <>
      <audio ref={audioRef} src={BEEP_SRC} preload="auto" />

      {hasAlert && (
        <button
          type="button"
          onClick={() => setHasAlert(false)}
          className="fixed top-4 right-4 z-[9999] w-14 h-14 rounded-full bg-red-600 border-4 border-red-300 flex flex-col items-center justify-center text-white text-[10px] font-bold animate-pulse shadow-lg"
          title="Alerta de pánico recibida"
        >
          ALERTA
        </button>
      )}
    </>
  );
}