// client/src/hooks/useRondasApi.js
import { useCallback } from "react";

/**
 * API base (módulo Rondas):
 *  - GET    /zones
 *  - GET    /zones/:id/checkpoints
 *  - POST   /shifts/start                 { zoneId }
 *  - POST   /shifts/:id/end
 *  - POST   /scans                        { shiftId, qrPayload?, checkpointId?, geo?, note? }
 *  - GET    /reports/summary?start=&end=
 *  - GET    /reports/exports.csv|xlsx|pdf|docx?start=&end=
 *  - CRUD   /plans
 */

const ROOT =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") +
  "/api/rondas/v1";

// Headers fake para dev (si aún no integras Auth real)
function devHeaders() {
  return {
    "x-user-id": "guard-ui",
    "x-roles": "admin,guard",
  };
}

async function jreq(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(ROOT + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...devHeaders(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(raw || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? JSON.parse(raw) : raw;
}

export function useRondasApi() {
  // ---- Zonas ----
  const listZones = useCallback(async () => jreq("/zones"), []);

  // ---- Checkpoints ----
  const zoneCheckpoints = useCallback(
    async (zoneId) => jreq(`/zones/${zoneId}/checkpoints`),
    []
  );

  // ---- Turnos ----
  const startShift = useCallback(
    async (zoneId) => jreq("/shifts/start", { method: "POST", body: { zoneId } }),
    []
  );
  const endShift = useCallback(
    async (shiftId) => jreq(`/shifts/${shiftId}/end`, { method: "POST" }),
    []
  );

  // ---- Escaneo (QR) ----
  const registerScan = useCallback(
    async ({ shiftId, qrPayload, checkpointId, geo, note }) =>
      jreq("/scans", { method: "POST", body: { shiftId, qrPayload, checkpointId, geo, note } }),
    []
  );

  // ---- Reportes / Dashboard ----
  const summary = useCallback(
    async ({ start = "", end = "" } = {}) =>
      jreq(`/reports/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    []
  );

  const exportUrl = useCallback(
    (fmt, { start = "", end = "" } = {}) =>
      `${ROOT}/reports/exports.${encodeURIComponent(fmt)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    []
  );

  // ---- Plans (rondas programadas) ----
  const listPlans = useCallback(
    async (zoneId) => jreq(`/plans${zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ""}`),
    []
  );
  const createPlan = useCallback(
    async (payload) => jreq("/plans", { method: "POST", body: payload }),
    []
  );
  const updatePlan = useCallback(
    async (id, payload) => jreq(`/plans/${id}`, { method: "PUT", body: payload }),
    []
  );
  const deletePlan = useCallback(
    async (id) => jreq(`/plans/${id}`, { method: "DELETE" }),
    []
  );

  return {
    listZones,
    zoneCheckpoints,
    startShift,
    endShift,
    registerScan,
    summary,
    exportUrl,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
  };
}

// (Opcional) geolocalización one-shot
export async function getGeoOnce() {
  if (!navigator.geolocation) return {};
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve({})
    );
  });
}
