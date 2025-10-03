// client/src/lib/incidentesApi.js
import api from "/src/lib/api.js";

/**
 * Lista de incidentes.
 * - Por defecto trae hasta 100.
 * - Puedes pasar más filtros en `params` (ej. { limit, page, estado, siteId }).
 *
 * GET /api/incidentes
 */
export async function listIncidentes(params = {}) {
  const { limit = 100, ...rest } = params;
  const { data } = await api.get("/api/incidentes", { params: { limit, ...rest } });
  return data;
}

/* Aliases opcionales por compatibilidad */
export async function list(params) {
  return listIncidentes(params);
}

/* Objeto de conveniencia */
const IncidentesAPI = {
  listIncidentes,
  list,
};

export default IncidentesAPI;
