// src/modules/rondasqr/api/rondasqrApi.js
const ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const BASE = `${ROOT}/api/rondasqr/v1`;

/** Permite inyectar un proveedor de token (Auth0, etc.) */
let tokenProvider = null;
export function attachRondasAuth(provider /* async () => string|null */) {
  tokenProvider = provider;
}

function toQS(o = {}) {
  return Object.entries(o)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function buildHeaders(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";

  // Auth Bearer (si fue inyectado)
  if (typeof tokenProvider === "function") {
    try {
      const token = await tokenProvider();
      if (token) h["Authorization"] = `Bearer ${token}`;
    } catch {}
  }

  // Headers DEV (con IAM_ALLOW_DEV_HEADERS=1 en el server)
  if (import.meta.env.DEV) {
    const devEmail =
      (typeof localStorage !== "undefined" && localStorage.getItem("iamDevEmail")) ||
      import.meta.env.VITE_DEV_IAM_EMAIL ||
      null;
    if (devEmail) h["x-user-email"] = devEmail;

    const devRoles = (typeof localStorage !== "undefined" && localStorage.getItem("iamDevRoles")) || "";
    if (devRoles) h["x-roles"] = devRoles; // p.ej. "admin,rondasqr.admin"
  }

  return h;
}

async function fetchJson(url, opts = {}) {
  // Sólo forzamos Content-Type si el body es JSON string
  const wantsJson = typeof opts?.body === "string";
  const r = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: { ...(await buildHeaders(wantsJson)), ...(opts.headers || {}) },
  });
  if (!r.ok) {
    let err = {};
    try {
      err = await r.json();
    } catch {}
    const e = new Error(`HTTP ${r.status}`);
    e.status = r.status;
    e.payload = err;
    throw e;
  }
  try {
    return await r.json();
  } catch {
    return null;
  }
}

export const rondasqrApi = {
  // -------- Reportes --------
  async getSummary(q) {
    return fetchJson(`${BASE}/reports/summary?${toQS(q)}`);
  },
  async getDetailed(q) {
    return fetchJson(`${BASE}/reports/detailed?${toQS(q)}`);
  },

  // Rutas conocidas que ya funcionan
  csvUrl(q) {
    return `${BASE}/reports/export/csv?${toQS(q)}`;
  },
  kmlUrl(q) {
    return `${BASE}/reports/export/kml?${toQS(q)}`;
  },

  // NUEVO: helpers para PDF/XLSX (nombre más probable en el backend)
  xlsxUrl(q) {
    return `${BASE}/reports/export/excel?${toQS(q)}`;
  },
  pdfUrl(q) {
    return `${BASE}/reports/export/pdf?${toQS(q)}`;
  },

  // NUEVO: ping a una URL de descarga para saber si existe (200 OK)
  async ping(url) {
    try {
      const r = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: await buildHeaders(false),
      });
      return r.ok;
    } catch {
      return false;
    }
  },

  // -------- Check-in / Guardia --------
  /** payload: { qr, hardwareId?, steps?, message?, gps?: {lat,lon} } */
  async postScan(payload) {
    return fetchJson(`${BASE}/checkin/scan`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },
  /** payload: { text, lat?, lon?, photosBase64?: string[] } */
  async postIncident(payload) {
    return fetchJson(`${BASE}/checkin/incidents`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },
  /** gps?: {lat, lon} */
  async panic(gps) {
    return fetchJson(`${BASE}/checkin/panic`, {
      method: "POST",
      body: JSON.stringify({ gps }),
    });
  },

  // -------- NUEVOS: alertas automáticas --------
  /** payload sugerido: { durationMin, stepsAtAlert, gps? } */
  async postInactivity(payload) {
    return fetchJson(`${BASE}/checkin/inactivity`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },
  /** payload sugerido: { stepsAtAlert, fallDetected, gps? } */
  async postFall(payload) {
    return fetchJson(`${BASE}/checkin/fall`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  // -------- Catálogos / Admin CRUD --------
  // Sites
  async listSites() {
    return fetchJson(`${BASE}/admin/sites`);
  },
  async createSite(body) {
    return fetchJson(`${BASE}/admin/sites`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },
  async updateSite(id, body) {
    return fetchJson(`${BASE}/admin/sites/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    });
  },
  async deleteSite(id) {
    return fetchJson(`${BASE}/admin/sites/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // Rounds
  async listRounds(siteId) {
    const q = siteId ? `?${toQS({ siteId })}` : "";
    return fetchJson(`${BASE}/admin/rounds${q}`);
  },
  async createRound(body) {
    return fetchJson(`${BASE}/admin/rounds`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },
  async updateRound(id, body) {
    return fetchJson(`${BASE}/admin/rounds/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    });
  },
  async deleteRound(id) {
    return fetchJson(`${BASE}/admin/rounds/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // Points
  async listPoints({ siteId, roundId } = {}) {
    const q = toQS({ siteId, roundId });
    return fetchJson(`${BASE}/admin/points${q ? `?${q}` : ""}`);
  },
  async createPoint(body) {
    return fetchJson(`${BASE}/admin/points`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },
  async updatePoint(id, body) {
    return fetchJson(`${BASE}/admin/points/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    });
  },
  async deletePoint(id) {
    return fetchJson(`${BASE}/admin/points/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // Plans
  async listPlans(q = {}) {
    const qs = toQS(q);
    return fetchJson(`${BASE}/admin/plans${qs ? `?${qs}` : ""}`);
  },
  async createPlan(body) {
    return fetchJson(`${BASE}/admin/plans`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },
  async updatePlan(id, body) {
    return fetchJson(`${BASE}/admin/plans/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    });
  },
  async deletePlan(id) {
    return fetchJson(`${BASE}/admin/plans/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

export default rondasqrApi;
