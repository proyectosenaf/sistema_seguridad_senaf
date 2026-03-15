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
  const suppressRemoteUntilRef = useRef(0);

  const [hasAlert, setHasAlert] = useState(false);
  const [alertMeta, setAlertMeta] = useState(null);
  const [audioReady, setAudioReady] = useState(false);

  // ✅ archivo real desde /public/audio
  const AUDIO_SRC = "/audio/panic-alarm.mp3";

  const stopAlarm = useCallback(() => {
    try {
      const el = audioRef.current;
      if (!el) return;
      el.pause();
      el.currentTime = 0;
    } catch {}
  }, []);

  const unlockAudio = useCallback(async () => {
    try {
      const el = audioRef.current;
      if (!el) return false;

      el.volume = 1;
      el.loop = false;
      el.muted = false;
      el.currentTime = 0;

      const p = el.play();
      if (p && typeof p.then === "function") await p;

      el.pause();
      el.currentTime = 0;

      setAudioReady(true);
      console.log("[GlobalPanicListener] audio ready");
      return true;
    } catch (e) {
      console.warn("[GlobalPanicListener] audio unlock failed:", e?.message || e);
      return false;
    }
  }, []);

  const playAlarm = useCallback(async () => {
    try {
      const el = audioRef.current;
      if (!el) return false;

      el.volume = 1;
      el.loop = true;
      el.muted = false;
      el.currentTime = 0;

      const p = el.play();
      if (p && typeof p.then === "function") await p;

      return true;
    } catch (e) {
      console.warn("[GlobalPanicListener] playAlarm blocked:", e?.message || e);
      return false;
    }
  }, []);

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

      const ok = await playAlarm();
      if (!ok) {
        console.warn("[GlobalPanicListener] alerta recibida, pero sin audio habilitado");
      }

      if (opts?.local === true) {
        suppressRemoteUntilRef.current = Date.now() + 4000;
      }
    },
    [playAlarm]
  );

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
      <audio ref={audioRef} src={AUDIO_SRC} preload="auto" playsInline />

      {!visitor && !audioReady && (
        <div className="fixed bottom-24 right-4 z-[9999] flex flex-col gap-2">
          <button
            type="button"
            onClick={unlockAudio}
            className="rounded-xl bg-amber-500 text-black font-semibold px-4 py-3 shadow-lg"
            title="Haz clic una vez para habilitar el sonido de alertas"
          >
            Activar sonido
          </button>

          <button
            type="button"
            onClick={async () => {
              const ok = await unlockAudio();
              if (ok) await playAlarm();
              setTimeout(() => stopAlarm(), 1500);
            }}
            className="rounded-xl bg-sky-500 text-white font-semibold px-4 py-3 shadow-lg"
            title="Probar alarma"
          >
            Probar sonido
          </button>
        </div>
      )}

      {hasAlert && !visitor && (
        <button
          type="button"
          onClick={() => {
            stopAlarm();
            setHasAlert(false);
          }}
          className="fixed top-4 right-4 z-[9999] w-20 h-20 rounded-full bg-red-600 border-4 border-red-300 flex flex-col items-center justify-center text-white text-[10px] font-bold animate-pulse shadow-lg"
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