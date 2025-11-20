// client/src/lib/socket.js
import { io } from "socket.io-client";
import { SOCKET_BASE } from "./api.js";

export const socket =
  typeof window !== "undefined"
    ? io(SOCKET_BASE, {
        transports: ["websocket", "polling"],
        path: "/socket.io",
        withCredentials: false,
        reconnectionAttempts: 5,
      })
    : null;
