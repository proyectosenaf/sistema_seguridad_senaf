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
    const hint = String(localStorage.getItem("senaf_is_visitor") || "").trim().toLowerCase();
    return hint === "1" || hint === "true" || hint === "yes";
  } catch {
    return false;
  }
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
    setHasAlert(true);
    setAlertMeta({
      title: payload?.title || "ALERTA",
      body: payload?.body || payload?.message || "",
      at: new Date().toLocaleTimeString(),
      source: payload?.source || opts?.source || "panic",
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

    const payload = {
      userId: principal?._id || principal?.id || principal?.sub || "",
      email: principal?.email || "",
      roles: principal?.roles || principal?.role || principal?.rol || [],
    };

    try {
      socket.emit("presence:join", payload);
    } catch (e) {
      console.warn("[GlobalPanicListener] presence:join error:", e?.message || e);
    }
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
      if (now < suppressRemoteUntilRef.current) {
        return;
      }

      triggerAlert(payload, { local: false, source: "socket" });
    }

    socket.on("panic:new", onRemotePanic);
    socket.on("alerta:nueva", onRemotePanic);

    return () => {
      socket.off("panic:new", onRemotePanic);
      socket.off("alerta:nueva", onRemotePanic);
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
