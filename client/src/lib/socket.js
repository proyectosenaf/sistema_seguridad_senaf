import { io } from "socket.io-client";
import { SOCKET_BASE } from "./api.js";

function normalizeSocketBase(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "").replace(/\/api\/?$/, "");
}

const BASE = normalizeSocketBase(SOCKET_BASE);
const FALLBACK = typeof window !== "undefined" ? window.location.origin : "";

const G = typeof window !== "undefined" ? window : globalThis;

if (!G.__SENAF_SOCKET__) {
  G.__SENAF_SOCKET__ = io(BASE || FALLBACK, {
    path: "/socket.io",

    transports: ["polling", "websocket"],
    upgrade: true,

    withCredentials: false,

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  G.__SENAF_SOCKET__.on("connect", () => {
    const transport =
      G.__SENAF_SOCKET__?.io?.engine?.transport?.name || "unknown";
    console.log(
      "[socket] connected:",
      G.__SENAF_SOCKET__.id,
      "transport:",
      transport
    );
  });

  G.__SENAF_SOCKET__.on("connect_error", (e) => {
    console.warn("[socket] connect_error:", e?.message || e);
  });

  G.__SENAF_SOCKET__.on("disconnect", (reason) => {
    console.warn("[socket] disconnected:", reason);
  });
}

export const socket = G.__SENAF_SOCKET__;

/* ================= CHAT HELPERS ================= */

export function joinGlobalChat(room = "global") {
  if (!socket) return;
  socket.emit("chat:join", { room });
}

export function leaveGlobalChat(room = "global") {
  if (!socket) return;
  socket.emit("chat:leave", { room });
}

export function joinPrivateChat(fromUserId, toUserId) {
  if (!socket) return;
  socket.emit("chat:private:join", { fromUserId, toUserId });
}

export function leavePrivateChat(fromUserId, toUserId, room) {
  if (!socket) return;
  socket.emit("chat:private:leave", { fromUserId, toUserId, room });
}

export function sendPrivateChatMessage(payload, cb) {
  if (!socket) return;
  socket.emit("chat:private:send", payload, cb);
}