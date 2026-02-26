// client/src/lib/socket.js
import { io } from "socket.io-client";
import { SOCKET_BASE } from "./api.js";

// Normaliza base: si viene con /api lo quitamos
function normalizeSocketBase(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "").replace(/\/api\/?$/, "");
}

const BASE = normalizeSocketBase(SOCKET_BASE);

// Fallback seguro si BASE quedó vacío
const FALLBACK =
  typeof window !== "undefined" ? window.location.origin : "";

export const socket =
  typeof window !== "undefined"
    ? io(BASE || FALLBACK, {
        path: "/socket.io",
        transports: ["websocket", "polling"],

        // Si tu backend usa cookies/sesión, pon true.
        // Si no usas autenticación basada en cookies, déjalo false.
        withCredentials: false,

        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      })
    : null;

// Debug opcional
if (socket) {
  socket.on("connect", () => {
    console.log("[socket] connected:", socket.id);
  });

  socket.on("connect_error", (e) => {
    console.warn("[socket] connect_error:", e?.message || e);
  });

  socket.on("disconnect", (reason) => {
    console.warn("[socket] disconnected:", reason);
  });
}