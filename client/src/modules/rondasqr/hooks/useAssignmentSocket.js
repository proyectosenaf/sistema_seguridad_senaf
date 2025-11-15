// client/src/modules/rondasqr/hooks/useAssignmentSocket.js
import { useEffect } from "react";
import { io } from "socket.io-client";
import { SOCKET_BASE } from "../../lib/api.js";

/**
 * Hook de socket para rondas:
 * - Une al usuario a sus rooms (user-<sub> y guard-<sub>)
 * - Escucha asignaciones nuevas, contadores y alertas de pánico
 */
export function useAssignmentSocket(user, onNotify, onCount) {
  useEffect(() => {
    const userId = user?.sub;
    if (!userId) return;

    // Base de socket: mismo host que la API pero sin /api
    const base =
      SOCKET_BASE ||
      (import.meta.env.VITE_API_BASE_URL || "").replace(/\/api\/?$/, "") ||
      window.location.origin;

    // Reutiliza una sola conexión global
    if (!window.__senafSocket) {
      window.__senafSocket = io(base, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
    }
    const socket = window.__senafSocket;

    // 🔁 Une al usuario a las rooms de guardia y usuario
    //   (el server escucha "join-room")
    socket.emit("join-room", { userId });

    // Nueva asignación
    const handleAssignment = (payload) => {
      try {
        onNotify?.(payload);

        // Notificación del navegador
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification(payload.title || "Asignación", {
              body: payload.body || "",
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") {
                new Notification(payload.title || "Asignación", {
                  body: payload.body || "",
                });
              }
            });
          }
        } else {
          alert(`${payload.title || "Asignación"}\n${payload.body || ""}`);
        }

        // Sonido
        const audio = new Audio("/sounds/notify.mp3");
        audio.play().catch(() => {});
      } catch {
        // ignorar fallo
      }
    };

    // Contador de notificaciones
    const handleCount = ({ count }) => onCount?.(count);

    // Alertas de pánico
    const handlePanic = (payload) => onNotify?.({ type: "panic", payload });
    const handleRondasPanic = (payload) =>
      onNotify?.({ type: "rondasqr:panic", payload });

    socket.on("rondasqr:nueva-asignacion", handleAssignment);
    socket.on("notifications:count-updated", handleCount);
    socket.on("panic", handlePanic);
    socket.on("rondasqr:panic", handleRondasPanic);

    return () => {
      socket.off("rondasqr:nueva-asignacion", handleAssignment);
      socket.off("notifications:count-updated", handleCount);
      socket.off("panic", handlePanic);
      socket.off("rondasqr:panic", handleRondasPanic);
    };
  }, [user?.sub, onNotify, onCount]);
}
