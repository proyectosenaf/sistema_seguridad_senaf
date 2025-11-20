// client/src/modules/rondasqr/hooks/useAssignmentSocket.js
import { useEffect } from "react";
<<<<<<< HEAD
import { io } from "socket.io-client";

import { SOCKET_BASE } from "../../../lib/api";

=======
import { socket } from "../../../lib/socket.js";
>>>>>>> 79ce776941e1dabe4f29507803aaa6b17a86c16e

/**
 * Hook de socket para rondas:
 * - Une al usuario a sus rooms (user-<sub> y guard-<sub>)
 * - Escucha asignaciones nuevas, contadores y alertas de pánico
 */
export function useAssignmentSocket(user, onNotify, onCount) {
  useEffect(() => {
    const userId = user?.sub;
    if (!userId) return;
    if (!socket) return; // seguridad por si algún día hay SSR o algo raro

    // 🔔 Nueva asignación de rondas
    const handleAssignment = (payload) => {
      try {
        onNotify?.(payload);

        // Notificación del navegador
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

    // 🔗 Suscribir eventos
    socket.on("rondasqr:nueva-asignacion", handleAssignment);
    socket.on("notifications:count-updated", handleCount);
    socket.on("panic", handlePanic);
    socket.on("rondasqr:panic", handleRondasPanic);

    // 🧹 Limpieza al desmontar / cambiar dependencias
    return () => {
      socket.off("rondasqr:nueva-asignacion", handleAssignment);
      socket.off("notifications:count-updated", handleCount);
      socket.off("panic", handlePanic);
      socket.off("rondasqr:panic", handleRondasPanic);
    };
  }, [user?.sub, onNotify, onCount]);
}
