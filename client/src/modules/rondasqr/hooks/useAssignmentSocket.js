// client/src/modules/rondasqr/hooks/useAssignmentSocket.js
import { useEffect } from "react";
import { io } from "socket.io-client";

/**
 * Hook de socket para rondas:
 * - Une al usuario a sus rooms (user-<sub> y guard-<sub>)
 * - Escucha asignaciones nuevas y contador de notificaciones
 *
 * @param {object} user   Objeto de Auth0 (debe tener .sub)
 * @param {function} onNotify  Callback cuando llega una nueva asignación
 * @param {function} onCount   (opcional) Callback cuando cambia "notifications:count-updated"
 */
export function useAssignmentSocket(user, onNotify, onCount) {
  useEffect(() => {
    const userId = user?.sub;
    if (!userId) return;

    // Resuelve base del backend (Vite)
    const base =
      (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "").replace(/\/$/, "") ||
      window.location.origin;

    // Reutiliza una instancia global para no abrir múltiples conexiones
    if (!window.__senafSocket) {
      window.__senafSocket = io(base, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
    }
    const socket = window.__senafSocket;

    // Une el socket a las rooms esperadas por el server
    socket.emit("join-room", { userId });

    // Listener: nueva asignación
    const handleAssignment = (payload) => {
      try {
        onNotify?.(payload);

        // Notificación del navegador
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification(payload.title || "Asignación", { body: payload.body || "" });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") {
                new Notification(payload.title || "Asignación", { body: payload.body || "" });
              }
            });
          }
        } else {
          alert(`${payload.title || "Asignación"}\n${payload.body || ""}`);
        }

        // Sonido (asegúrate de tener este archivo en /public/sounds/notify.mp3)
        const audio = new Audio("/sounds/notify.mp3");
        audio.play().catch(() => {});
      } catch {}
    };

    // Listener: contador de notificaciones
    const handleCount = ({ count }) => {
      onCount?.(count);
    };

    socket.on("rondasqr:nueva-asignacion", handleAssignment);
    socket.on("notifications:count-updated", handleCount);

    // Limpieza: quitamos solo los listeners añadidos
    return () => {
      socket.off("rondasqr:nueva-asignacion", handleAssignment);
      socket.off("notifications:count-updated", handleCount);
    };
  }, [user?.sub, onNotify, onCount]);
}
