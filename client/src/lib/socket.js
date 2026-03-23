// client/src/lib/socket.js
import { io } from "socket.io-client";
import { SOCKET_BASE } from "./api.js";

function normalizeSocketBase(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "").replace(/\/api\/?$/, "");
}

function normalizeRolesInput(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .flatMap((item) =>
            typeof item === "string"
              ? item.split(",")
              : item == null
              ? []
              : [String(item)]
          )
          .map((r) => String(r || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((r) => String(r || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  if (value == null) return [];
  return [String(value).trim().toLowerCase()].filter(Boolean);
}

function normalizeIdentityPayload(payload = {}) {
  return {
    userId:
      payload?.userId ||
      payload?.id ||
      payload?._id ||
      payload?.sub ||
      "",
    email: String(payload?.email || "")
      .trim()
      .toLowerCase(),
    roles: normalizeRolesInput(
      payload?.roles || payload?.role || payload?.rol || []
    ),
  };
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
    autoConnect: true,
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

  G.__SENAF_SOCKET__.on("reconnect_attempt", (attempt) => {
    console.log("[socket] reconnect_attempt:", attempt);
  });

  G.__SENAF_SOCKET__.on("reconnect", (attempt) => {
    console.log("[socket] reconnected after attempts:", attempt);
  });
}

export const socket = G.__SENAF_SOCKET__;

/* ================= CORE HELPERS ================= */

export function ensureSocketConnected() {
  if (!socket) return;
  if (!socket.connected) socket.connect();
}

export function joinPresence(payload = {}) {
  if (!socket) return;
  ensureSocketConnected();
  socket.emit("presence:join", normalizeIdentityPayload(payload));
}

export function joinAuth(payload = {}) {
  if (!socket) return;
  ensureSocketConnected();
  socket.emit("auth:join", normalizeIdentityPayload(payload));
}

export function joinSocketIdentity(payload = {}) {
  if (!socket) return;
  ensureSocketConnected();

  const identity = normalizeIdentityPayload(payload);

  socket.emit("join", identity);
  socket.emit("presence:join", identity);
  socket.emit("auth:join", identity);
}

export function emitPanicAlert(payload = {}, cb) {
  if (!socket) return;
  ensureSocketConnected();

  socket.emit("panic:emit", payload, cb);
}

export function onPanicAlert(handler) {
  if (!socket || typeof handler !== "function") return () => {};

  socket.on("panic:new", handler);
  socket.on("alerta:nueva", handler);
  socket.on("rondasqr:alert", handler);

  return () => {
    socket.off("panic:new", handler);
    socket.off("alerta:nueva", handler);
    socket.off("rondasqr:alert", handler);
  };
}

/* ================= CHAT HELPERS ================= */

export function joinGlobalChat(room = "global") {
  if (!socket) return;
  ensureSocketConnected();
  socket.emit("chat:join", { room });
}

export function leaveGlobalChat(room = "global") {
  if (!socket) return;
  socket.emit("chat:leave", { room });
}

export function joinPrivateChat(fromUserId, toUserId) {
  if (!socket) return;
  ensureSocketConnected();
  socket.emit("chat:private:join", { fromUserId, toUserId });
}

export function leavePrivateChat(fromUserId, toUserId, room) {
  if (!socket) return;
  socket.emit("chat:private:leave", { fromUserId, toUserId, room });
}

export function sendPrivateChatMessage(payload, cb) {
  if (!socket) return;
  ensureSocketConnected();
  socket.emit("chat:private:send", payload, cb);
}