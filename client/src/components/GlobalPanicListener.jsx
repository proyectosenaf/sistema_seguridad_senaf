// client/src/components/GlobalPanicListener.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { subscribeLocalPanic } from "../modules/rondasqr/utils/panicBus.js";
import { useAuth } from "../pages/auth/AuthProvider.jsx";
import { socket } from "../lib/socket.js";

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function normalizeRoleName(role) {
  if (!role) return "";

  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function resolvePrincipal(user) {
  if (!user || typeof user !== "object") return null;

  if (user.user && typeof user.user === "object") {
    return {
      ...user.user,
      can:
        user?.can && typeof user.can === "object"
          ? user.can
          : user?.user?.can && typeof user.user.can === "object"
          ? user.user.can
          : {},
      superadmin:
        user?.superadmin === true ||
        user?.isSuperAdmin === true ||
        user?.user?.superadmin === true ||
        user?.user?.isSuperAdmin === true,
    };
  }

  return {
    ...user,
    can: user?.can && typeof user.can === "object" ? user.can : {},
    superadmin: user?.superadmin === true || user?.isSuperAdmin === true,
  };
}

function getRolesFromUser(user) {
  const u = resolvePrincipal(user) || {};
  const roles = [
    ...toArray(u?.roles),
    ...toArray(u?.role),
    ...toArray(u?.rol),
  ]
    .map(normalizeRoleName)
    .filter(Boolean);

  return [...new Set(roles)];
}

function isVisitorUser(user) {
  const roles = getRolesFromUser(user);

  if (
    roles.some((r) =>
      ["visitante", "visitantes", "visita", "visitor", "visitors"].includes(r)
    )
  ) {
    return true;
  }

  try {
    const hint = String(localStorage.getItem("senaf_is_visitor") || "")
      .trim()
      .toLowerCase();
    return hint === "1" || hint === "true" || hint === "yes";
  } catch {
    return false;
  }
}

function normalizeRemotePayload(payload = {}) {
  const item = payload?.item && typeof payload.item === "object" ? payload.item : null;
  const meta = payload?.meta && typeof payload.meta === "object" ? payload.meta : {};

  return {
    title:
      payload?.title ||
      (payload?.kind === "panic" ? "🚨 Alerta de pánico" : null) ||
      (item?.type === "panic" ? "🚨 Alerta de pánico" : null) ||
      "ALERTA",
    body:
      payload?.body ||
      payload?.message ||
      item?.text ||
      meta?.body ||
      (payload?.kind === "panic" ? "Se activó el botón de pánico" : "") ||
      "",
    source: payload?.source || payload?.kind || item?.type || "socket",
    at: payload?.ts || item?.at || Date.now(),
  };
}

export default function GlobalPanicListener() {
  const { isAuthenticated, user } = useAuth();

  const principal = resolvePrincipal(user) || {};
  const visitor = isVisitorUser(principal);

  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const suppressRemoteUntilRef = useRef(0);

  const [hasAlert, setHasAlert] = useState(false);
  const [alertMeta, setAlertMeta] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const BEEP_SRC =
    "data:audio/wav;base64,UklGRlCZAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YTmZAACAgICAgICAgICAgP//////AAD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP////8=";

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  const playOscillatorAlarm = useCallback(async () => {
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return false;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(660, now + 0.18);
      osc.frequency.linearRampToValueAtTime(880, now + 0.36);
      osc.frequency.linearRampToValueAtTime(660, now + 0.54);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.50);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.62);

      osc.start(now);
      osc.stop(now + 0.65);

      return true;
    } catch (e) {
      console.warn("[GlobalPanicListener] oscillator blocked:", e?.message || e);
      return false;
    }
  }, [ensureAudioContext]);

  const unlockAudio = useCallback(async () => {
    try {
      const ctx = ensureAudioContext();
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }

      const el = audioRef.current;
      if (el) {
        el.muted = true;
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.then === "function") await p;
        el.pause();
        el.currentTime = 0;
        el.muted = false;
      }

      setAudioUnlocked(true);
      console.log("[GlobalPanicListener] audio unlocked");
    } catch (e) {
      console.warn("[GlobalPanicListener] audio unlock blocked:", e?.message || e);
    }
  }, [ensureAudioContext]);

  const playBeep = useCallback(async () => {
    // 1) intenta audio normal
    try {
      const el = audioRef.current;
      if (el) {
        el.muted = false;
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.then === "function") {
          await p;
        }
        return true;
      }
    } catch (e) {
      console.warn("[GlobalPanicListener] html audio blocked:", e?.message || e);
    }

    // 2) fallback Web Audio API
    return await playOscillatorAlarm();
  }, [playOscillatorAlarm]);

  const triggerAlert = useCallback(
    async (payload = {}, opts = {}) => {
      const normalized = normalizeRemotePayload(payload);

      setHasAlert(true);
      setAlertMeta({
        title: normalized.title || "ALERTA",
        body: normalized.body || "",
        at: new Date(normalized.at || Date.now()).toLocaleTimeString(),
        source: opts?.source || normalized.source || "panic",
      });

      const played = await playBeep();
      if (!played) {
        console.warn("[GlobalPanicListener] no se pudo reproducir sonido");
      }

      if (opts?.local === true) {
        suppressRemoteUntilRef.current = Date.now() + 4000;
      }
    },
    [playBeep]
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const onceUnlock = () => {
      unlockAudio().catch(() => {});
    };

    window.addEventListener("pointerdown", onceUnlock, { once: true });
    window.addEventListener("keydown", onceUnlock, { once: true });
    window.addEventListener("touchstart", onceUnlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onceUnlock);
      window.removeEventListener("keydown", onceUnlock);
      window.removeEventListener("touchstart", onceUnlock);
    };
  }, [isAuthenticated, unlockAudio]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const joinPayload = {
      userId: principal?._id || principal?.id || principal?.sub || "",
      email: principal?.email || "",
      roles: principal?.roles || principal?.role || principal?.rol || [],
    };

    const doPresenceJoin = () => {
      try {
        socket.emit("presence:join", joinPayload);
      } catch (e) {
        console.warn("[GlobalPanicListener] presence:join error:", e?.message || e);
      }
    };

    doPresenceJoin();
    socket.on("connect", doPresenceJoin);

    return () => {
      socket.off("connect", doPresenceJoin);
    };
  }, [
    isAuthenticated,
    principal?._id,
    principal?.id,
    principal?.sub,
    principal?.email,
    principal?.roles,
    principal?.role,
    principal?.rol,
  ]);

  useEffect(() => {
    const unsub = subscribeLocalPanic((payload) => {
      if (!isAuthenticated) return;
      if (visitor) return;
      triggerAlert(payload, { local: true, source: "local-bus" });
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [isAuthenticated, visitor, triggerAlert]);

  useEffect(() => {
    if (!isAuthenticated) return;

    function onRemotePanic(payload = {}) {
      if (visitor) return;

      const now = Date.now();
      if (now < suppressRemoteUntilRef.current) return;

      triggerAlert(payload, { local: false, source: "socket" });
    }

    socket.on("panic:new", onRemotePanic);
    socket.on("alerta:nueva", onRemotePanic);
    socket.on("rondasqr:alert", onRemotePanic);

    return () => {
      socket.off("panic:new", onRemotePanic);
      socket.off("alerta:nueva", onRemotePanic);
      socket.off("rondasqr:alert", onRemotePanic);
    };
  }, [isAuthenticated, visitor, triggerAlert]);

  if (!isAuthenticated) return null;

  return (
    <>
      <audio ref={audioRef} src={BEEP_SRC} preload="auto" playsInline />

      {hasAlert && !visitor && (
        <button
          type="button"
          onClick={async () => {
            if (!audioUnlocked) {
              await unlockAudio();
            }
            setHasAlert(false);
          }}
          className="fixed top-4 right-4 z-[9999] w-16 h-16 rounded-full bg-red-600 border-4 border-red-300 flex flex-col items-center justify-center text-white text-[10px] font-bold animate-pulse shadow-lg"
          title={
            alertMeta?.body
              ? `${alertMeta?.title || "ALERTA"} • ${alertMeta.body}`
              : "Alerta de pánico recibida"
          }
        >
          <span className="leading-none">ALERTA</span>
          <span className="leading-none mt-1 text-[9px]">
            {alertMeta?.at || "NUEVA"}
          </span>
        </button>
      )}
    </>
  );
}