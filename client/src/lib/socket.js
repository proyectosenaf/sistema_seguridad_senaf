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
const FALLBACK = typeof window !== "undefined" ? window.location.origin : "";

// ✅ Single instance global (evita duplicados por HMR/StrictMode)
const G = typeof window !== "undefined" ? window : globalThis;

if (!G.__SENAF_SOCKET__) {
  G.__SENAF_SOCKET__ = io(BASE || FALLBACK, {
    path: "/socket.io",

    // ✅ polling primero, luego upgrade a websocket
    transports: ["polling", "websocket"],
    upgrade: true,

    withCredentials: false,

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Debug
  G.__SENAF_SOCKET__.on("connect", () => {
    const transport = G.__SENAF_SOCKET__?.io?.engine?.transport?.name || "unknown";
    console.log("[socket] connected:", G.__SENAF_SOCKET__.id, "transport:", transport);
  });

  G.__SENAF_SOCKET__.on("connect_error", (e) => {
    console.warn("[socket] connect_error:", e?.message || e);
  });

  G.__SENAF_SOCKET__.on("disconnect", (reason) => {
    console.warn("[socket] disconnected:", reason);
  });
}

export const socket = G.__SENAF_SOCKET__;