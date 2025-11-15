// client/src/lib/notificationsApi.js
import api from "./api.js";

/**
 * API mínima para notificaciones. Tolera que el backend no tenga endpoints:
 * - getCount() -> número (0 si falla)
 * - onRealtime(socket, cb) -> subscribe; retorna un unsubscribe()
 * - markAllRead() -> boolean
 *
 * Backend actual:
 *   GET  /api/notifications/count     -> { count }
 *   POST /api/notifications/read-all  -> { ok, updated }
 */
const NotificationsAPI = {
  async getCount() {
    try {
      // baseURL = http://localhost:4000/api → /notifications/count
      const r = await api.get("/notifications/count");
      return r?.data?.count ?? 0;
    } catch {
      return 0; // cascarón: no hay backend, devolvemos 0
    }
  },

  onRealtime(socket, cb) {
    // Suscripción al evento si usas socket.io; si no, no hace nada.
    if (!socket || typeof socket.on !== "function") return () => {};
    const evt = "notifications:count-updated";
    const handler = (p) => cb?.(p?.count ?? 0);
    socket.on(evt, handler);
    return () => socket.off(evt, handler);
  },

  async markAllRead() {
    try {
      await api.post("/notifications/read-all");
      return true;
    } catch {
      return false; // cascarón: ignora fallo
    }
  },
};

export default NotificationsAPI;
