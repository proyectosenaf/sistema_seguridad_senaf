// client/src/lib/rondasApi.js
import api from "/src/lib/api.js";

/**
 * Deriva la BASE de la API desde tu axios (AuthTokenBridge ya mete el token).
 * En server montas todo en /api, así que aquí usamos rutas absolutas /api/...
 */
const API_BASE = (api.defaults.baseURL || "").replace(/\/$/, "");

/* ============================================================================
 * Rutas
 * ==========================================================================*/
/** GET /api/rondas/routes */
async function getRoutes(params = {}) {
  const { data } = await api.get(`${API_BASE}/api/rondas/routes`, { params });
  return data;
}

/* ============================================================================
 * Shifts activos
 * ==========================================================================*/
/** GET /api/rondas/active */
async function getRondasActivas() {
  const { data } = await api.get(`${API_BASE}/api/rondas/active`);
  return data;
}
async function getActive() {
  return getRondasActivas();
}

/* ============================================================================
 * Shifts: start / finish / check
 * ==========================================================================*/
/** POST /api/rondas/shifts/start */
async function startShift(a, b, c, d) {
  // Soporta startShift({routeId, guardExternalId, deviceId?, appVersion?})
  // o startShift(routeId, guardExternalId, deviceId?, appVersion?)
  const payload =
    a && typeof a === "object"
      ? a
      : { routeId: a, guardExternalId: b, deviceId: c, appVersion: d };
  const { data } = await api.post(`${API_BASE}/api/rondas/shifts/start`, payload);
  return data;
}

/** POST /api/rondas/shifts/:id/finish */
async function finishShift(id, body = {}) {
  const { data } = await api.post(`${API_BASE}/api/rondas/shifts/${id}/finish`, body);
  return data;
}

/**
 * POST /api/rondas/shifts/:id/check
 *
 * Firma nueva recomendada:
 *   checkPoint(shiftId, { cpCode, method?, gps?, notes?, photos?, rawPayload?, clientAt?, device? })
 *
 * Retrocompat:
 *   checkPoint({ shiftId, checkpointCode, method, location, evidences, ... })
 *   checkPoint({ shiftId, cpCode, ... })
 */
async function checkPoint(arg1, arg2) {
  // Normaliza firma
  let shiftId, payload;

  if (typeof arg1 === "string") {
    shiftId = arg1;
    payload = arg2 || {};
  } else if (arg1 && typeof arg1 === "object") {
    // payload legacy podía traer shiftId adentro
    shiftId = arg1.shiftId || arg1.id || arg1._id;
    payload = { ...arg1 };
    delete payload.shiftId;
    delete payload.id;
    delete payload._id;
  } else {
    throw new Error("Firma inválida en checkPoint()");
  }

  // Mapeo retrocompat:
  // checkpointCode -> cpCode
  if (!payload.cpCode && payload.checkpointCode) {
    payload.cpCode = payload.checkpointCode;
    delete payload.checkpointCode;
  }
  // location -> gps
  if (!payload.gps && payload.location) {
    payload.gps = payload.location;
    delete payload.location;
  }
  // evidences -> photos
  if (!payload.photos && payload.evidences) {
    payload.photos = payload.evidences;
    delete payload.evidences;
  }
  // methodMeta -> device (en server usamos "device")
  if (!payload.device && payload.methodMeta) {
    payload.device = payload.methodMeta;
    delete payload.methodMeta;
  }

  // Validación mínima
  if (!payload.cpCode) {
    throw new Error("cpCode es requerido (antes 'checkpointCode').");
  }

  const { data } = await api.post(`${API_BASE}/api/rondas/shifts/${shiftId}/check`, payload);
  return data;
}

// Alias legacy para compatibilidad con código antiguo
async function check(payload) {
  return checkPoint(payload);
}

/* ============================================================================
 * QR de checkpoint
 * ==========================================================================*/
function getCheckpointQRUrl(routeId, code, { fmt = "svg", download = false, label = false } = {}) {
  const base = (api.defaults.baseURL || "").replace(/\/$/, "");
  const params = new URLSearchParams({
    routeId,
    code,
    fmt,
    download: download ? "1" : "0",
    label: label ? "1" : "0",
  });
  return `${base}/api/rondas/qr/checkpoint?${params.toString()}`;
}

/* ============================================================================
 * Asignaciones
 * ==========================================================================*/
/** GET /api/rondas/assignments */
async function listAssignments(query = {}) {
  const { data } = await api.get(`${API_BASE}/api/rondas/assignments`, { params: query });
  return data;
}

/** POST /api/rondas/assignments */
async function createAssignment(payload) {
  const { data } = await api.post(`${API_BASE}/api/rondas/assignments`, payload);
  return data;
}

/** PATCH /api/rondas/assignments/:id */
async function updateAssignment(id, payload) {
  const { data } = await api.patch(`${API_BASE}/api/rondas/assignments/${id}`, payload);
  return data;
}

/** DELETE /api/rondas/assignments/:id */
async function deleteAssignment(id) {
  const { data } = await api.delete(`${API_BASE}/api/rondas/assignments/${id}`);
  return data;
}

/* ============================================================================
 * Export conveniente
 * ==========================================================================*/
const RondasAPI = {
  // rutas
  getRoutes,
  // activos
  getRondasActivas,
  getActive,
  // shifts
  startShift,
  finishShift,
  checkPoint,
  check,
  // qr
  getCheckpointQRUrl,
  // asignaciones
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};

export {
  getRoutes,
  getRondasActivas,
  getActive,
  startShift,
  finishShift,
  checkPoint,
  check,
  getCheckpointQRUrl,
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  RondasAPI,
};

export default RondasAPI;
