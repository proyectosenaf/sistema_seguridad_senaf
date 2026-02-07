// client/src/lib/socket.js
import { io } from "socket.io-client";
import { SOCKET_BASE } from "./api.js";

export const socket =
  typeof window !== "undefined"
    ? io(SOCKET_BASE, {
        path: "/socket.io",
        transports: ["websocket", "polling"], // intento ws y si no, polling
        withCredentials: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 600,
        timeout: 8000,
      })
    : null;

// Debug opcional (útil si sigue fallando ws)
if (socket) {
  socket.on("connect", () => console.log("[socket] connected:", socket.id));
  socket.on("connect_error", (e) =>
    console.warn("[socket] connect_error:", e?.message || e)
  );
  socket.on("disconnect", (reason) =>
    console.warn("[socket] disconnected:", reason)
  );
}
