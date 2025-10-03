// client/src/lib/notificationsApi.js
import api from "/src/lib/api.js";

/**
 * Obtiene los contadores de notificaciones.
 * GET /api/notifications/counts
 *
 * Opcionalmente puedes pasar filtros en params (ej: { siteId }).
 */
export async function getNotificationCounts(params = {}) {
  try {
    const { data } = await api.get("/api/notifications/counts", { params });
    return data;
  } catch (err) {
    console.error("[notificationsApi] Error al obtener counts:", err);
    throw err?.response?.data || err;
  }
}

// Alias por compatibilidad
export async function getCounts(params) {
  return getNotificationCounts(params);
}

// Objeto unificado
const NotificationsAPI = {
  getNotificationCounts,
  getCounts,
};

export default NotificationsAPI;
