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
  // Compatibilidad con:
  // - panic:new
  // - alerta:nueva
  // - rondasqr:alert { kind, item }
  // - notify payload con meta/item
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
    source:
      payload?.source ||
      payload?.kind ||
      item?.type ||
      "socket",
    at:
      payload?.ts ||
      item?.at ||
      Date.now(),
    raw: payload,
    item,
    meta,
  };
}

export default function GlobalPanicListener() {
  const { isAuthenticated, user } = useAuth();

  const principal = resolvePrincipal(user) || {};
  const visitor = isVisitorUser(principal);

  const audioRef = useRef(null);
  const [hasAlert, setHasAlert] = useState(false);
  const [alertMeta, setAlertMeta] = useState(null);
  const suppressRemoteUntilRef = useRef(0);

  const BEEP_SRC =
    "data:audio/wav;base64,UklGRlCZAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YTmZAACAgICAgICAgICAgP//////AAD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP///////wD///8AAAAAAP////8=";

  const triggerAlert = useCallback((payload = {}, opts = {}) => {
    const normalized = normalizeRemotePayload(payload);

    setHasAlert(true);
    setAlertMeta({
      title: normalized.title || "ALERTA",
      body: normalized.body || "",
      at: new Date(normalized.at || Date.now()).toLocaleTimeString(),
      source: opts?.source || normalized.source || "panic",
    });

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch {
      // ignore
    }

    if (opts?.local === true) {
      suppressRemoteUntilRef.current = Date.now() + 4000;
    }
  }, []);

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
        console.log("[GlobalPanicListener] presence:join", joinPayload);
      } catch (e) {
        console.warn("[GlobalPanicListener] presence:join error:", e?.message || e);
      }
    };

    // registrar de inmediato
    doPresenceJoin();

    // y volver a registrar al reconectar
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

      console.log("[GlobalPanicListener] local panic", payload);
      triggerAlert(payload, { local: true, source: "local-bus" });
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [isAuthenticated, visitor, triggerAlert]);

  useEffect(() => {
    if (!isAuthenticated) return;

    function onRemotePanic(payload = {}) {
      console.log("[GlobalPanicListener] remote panic event", payload);

      if (visitor) return;

      const now = Date.now();
      if (now < suppressRemoteUntilRef.current) {
        console.log("[GlobalPanicListener] remote panic suppressed (local already fired)");
        return;
      }

      triggerAlert(payload, { local: false, source: "socket" });
    }

    // ✅ eventos nuevos
    socket.on("panic:new", onRemotePanic);
    socket.on("alerta:nueva", onRemotePanic);

    // ✅ compatibilidad legacy
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
      <audio ref={audioRef} src={BEEP_SRC} preload="auto" />

      {hasAlert && !visitor && (
        <button
          type="button"
          onClick={() => setHasAlert(false)}
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
