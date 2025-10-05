// client/src/lib/rondasApi.js
const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") + "/api/rondas/v1";

async function req(path, { method = "GET", body, token, headers = {}, params } = {}) {
  // querystring opcional
  const qs = params && Object.keys(params).length
    ? "?" + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
        )
      ).toString()
    : "";

  const res = await fetch(BASE + path + qs, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // fallback dev para pegarle al API sin Auth0
      ...(token ? {} : { "x-user-id": "guard-demo-1", "x-roles": "admin,guard" }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.text()) || msg; } catch {}
    throw new Error(msg);
  }

  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

/* REST simple (para Dashboard, etc.) */
export const rapi = {
  get:    (url, config = {})                 => req(url, { ...config, method: "GET" }),
  post:   (url, data, config = {})           => req(url, { ...config, method: "POST", body: data }),
  patch:  (url, data, config = {})           => req(url, { ...config, method: "PATCH", body: data }),
  put:    (url, data, config = {})           => req(url, { ...config, method: "PUT", body: data }),
  delete: (url, config = {})                 => req(url, { ...config, method: "DELETE" }),
};

/* Helpers por recurso (opcional en otras pantallas) */
export const RondasApi = {
  listZones:           (t)                 => req("/zones", { token: t }),
  createZone:          (payload, t)        => req("/zones", { method: "POST", body: payload, token: t }),
  updateZone:          (id, payload, t)    => req(`/zones/${id}`, { method: "PATCH", body: payload, token: t }),
  deleteZone:          (id, t)             => req(`/zones/${id}`, { method: "DELETE", token: t }),

  zoneCheckpoints:     (zoneId, t)         => req(`/zones/${zoneId}/checkpoints`, { token: t }),
  createCheckpoint:    (zoneId, payload,t) => req(`/zones/${zoneId}/checkpoints`, { method: "POST", body: payload, token: t }),
  getCheckpointQR:     (id, format="png", t) => req(`/checkpoints/${id}/qr`, { token: t, params: { format } }),

  startShift:          (zoneId, t)         => req("/shifts/start", { method: "POST", body: { zoneId }, token: t }),
  endShift:            (shiftId, t)        => req(`/shifts/${shiftId}/end`, { method: "POST", token: t }),

  registerScan:        (payload, t)        => req("/scans", { method: "POST", body: payload, token: t }),

  listPlans:           (zoneId, t)         => req("/plans", { token: t, params: { zoneId } }),
  createPlan:          (payload, t)        => req("/plans", { method: "POST", body: payload, token: t }),
  updatePlan:          (planId, payload,t) => req(`/plans/${planId}`, { method: "PATCH", body: payload, token: t }),
  deletePlan:          (planId, t)         => req(`/plans/${planId}`, { method: "DELETE", token: t }),

  getSummary:          ({ from, to } = {}, t) =>
    req("/reports/summary", { token: t, params: { from, to } }),
  exportCsv:           ({ from, to } = {}, t) =>
    req("/reports/exports.csv", { token: t, params: { from, to }, headers: { Accept: "text/csv" } }),
  exportXlsx:          ({ from, to } = {}, t) =>
    req("/reports/exports.xlsx", { token: t, params: { from, to }, headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }),
  exportPdf:           ({ from, to } = {}, t) =>
    req("/reports/exports.pdf", { token: t, params: { from, to }, headers: { Accept: "application/pdf" } }),

  createIncident:      (payload, t)        => req("/incidents", { method: "POST", body: payload, token: t }),
  listIncidents:       (filters = {}, t)   => req("/incidents", { token: t, params: filters }),
  getIncident:         (id, t)             => req(`/incidents/${id}`, { token: t }),
  updateIncident:      (id, payload, t)    => req(`/incidents/${id}`, { method: "PATCH", body: payload, token: t }),
  ackIncident:         (id, t)             => req(`/incidents/${id}/ack`, { method: "POST", token: t }),
  closeIncident:       (id, note, t)       => req(`/incidents/${id}/close`, { method: "POST", body: { note }, token: t }),
};

export default RondasApi;
