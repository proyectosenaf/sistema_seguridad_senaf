// client/src/modules/rondasqr/hooks/useAssignmentSocket.js
import { useEffect } from "react";
import { socket } from "../../../lib/socket.js";

/**
 * Hook de socket para rondas:
 * - Escucha asignaciones nuevas, contadores y alertas de pánico
 */
export function useAssignmentSocket(user, onNotify, onCount) {
  useEffect(() => {
    const userId = user?.sub;
    if (!userId) return;
    if (!socket) return;

    const handleAssignment = (payload) => {
      try {
        onNotify?.(payload);

        if (typeof window !== "undefined" && "Notification" in window) {
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

        const audio = new Audio("/sounds/notify.mp3");
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    };

    const handleCount = ({ count }) => onCount?.(count);

    const handlePanic = (payload) => onNotify?.({ type: "panic", payload });
    const handleRondasPanic = (payload) => onNotify?.({ type: "rondasqr:panic", payload });

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
