// client/src/modules/rondasqr/api/rondasqrApi.js

import { API, getToken } from "../../../lib/api.js";

// Convención: API YA incluye /api
// ej. http://localhost:4000/api | https://tu-dominio.com/api
const ROOT = String(API || "http://localhost:4000/api").replace(/\/$/, "");

// Base de RondasQR: /api/rondasqr/v1
const BASE = `${ROOT}/rondasqr/v1`;

// ✅ Si tu auth es JWT (lo tuyo), usa omit.
// Si en algún entorno usas cookies/sesión, cambia a "include" aquí y listo.
const DEFAULT_CREDENTIALS = "omit"; // "omit" | "include"

/* ───────────── querystring ───────────── */
function toQS(o = {}) {
  return Object.entries(o)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/* ───────────── helpers ───────────── */
function toId(v) {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object") return v._id || v.id || null;
  return null;
}

function normalizePlanBody(body = {}) {
  const siteId = toId(body.siteId ?? body.site ?? body.site_id);
  const roundId = toId(body.roundId ?? body.round ?? body.round_id);

  const rawArray = Array.isArray(body.points)
    ? body.points
    : Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.pointIds)
    ? body.pointIds
    : [];

  const points = rawArray
    .map((p, idx) => {
      if (typeof p === "string") return { pointId: p, order: idx };
      if (typeof p === "object" && p) {
        const pid = toId(p.pointId ?? p.point_id ?? p._id ?? p.id);
        const ord = Number.isFinite(p.order) ? p.order : idx;
        return pid ? { pointId: pid, order: ord } : null;
      }
      return null;
    })
    .filter(Boolean);

  if (points.length === 0 && Array.isArray(body.pointIds)) {
    return {
      siteId,
      roundId,
      points: body.pointIds
        .filter(Boolean)
        .map((id, i) => ({ pointId: String(id), order: i })),
    };
  }

  return { siteId, roundId, points };
}

/**
 * ✅ Headers centralizados:
 * - JSON Content-Type cuando aplica
 * - Authorization Bearer <token> desde lib/api.js (senaf_token)
 */
async function buildHeaders({ json = true, token } = {}) {
  const h = {};

  if (json) h["Content-Type"] = "application/json";

  const t = String(token || getToken?.() || "").trim();
  if (t) h["Authorization"] = `Bearer ${t}`;

  h["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
  h["Pragma"] = "no-cache";

  return h;
}

async function fetchJson(url, opts = {}) {
  const body = opts?.body;
  const wantsJson = typeof body === "string";

  const r = await fetch(url, {
    credentials: opts.credentials || DEFAULT_CREDENTIALS,
    cache: "no-store",
    ...opts,
    headers: {
      ...(await buildHeaders({ json: wantsJson, token: opts.token })),
      ...(opts.headers || {}),
    },
  });

  if (!r.ok) {
    let err = {};
    let text = "";

    try {
      err = await r.json();
    } catch {
      try {
        text = await r.text();
      } catch {}
    }

    const e = new Error(err?.message || err?.error || text || `HTTP ${r.status}`);
    e.status = r.status;
    e.payload = err;
    e.text = text;
    throw e;
  }

  if (r.status === 204) return { ok: true };

  const contentType = String(r.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return await r.json();
  }

  const text = await r.text();
  return { ok: true, raw: text };
}

/* ───────────── API principal ───────────── */
export const rondasqrApi = {
  // -------- Reportes --------
  async getSummary(q) {
    return fetchJson(`${BASE}/reports/summary?${toQS(q)}`);
  },

  async getDetailed(q) {
    return fetchJson(`${BASE}/reports/detailed?${toQS(q)}`);
  },

  async reportsSummary(q) {
    return this.getSummary(q);
  },

  async summary(q) {
    return this.getSummary(q);
  },

  async listReports(q) {
    return this.getDetailed(q);
  },

  async reports(q) {
    return this.getDetailed(q);
  },

  async listCheckins(q) {
    return this.getDetailed(q);
  },

  csvUrl(q) {
    return `${BASE}/reports/export/csv?${toQS(q)}`;
  },

  kmlUrl(q) {
    return `${BASE}/reports/export/kml?${toQS(q)}`;
  },

  xlsxUrl(q) {
    return `${BASE}/reports/export/excel?${toQS(q)}`;
  },

  pdfUrl(q) {
    return `${BASE}/reports/export/pdf?${toQS(q)}`;
  },

  async ping(url) {
    try {
      const r = await fetch(url, {
        method: "GET",
        credentials: DEFAULT_CREDENTIALS,
        headers: await buildHeaders({ json: false }),
      });
      return r.ok;
    } catch {
      return false;
    }
  },

  // -------- Check-in / Guardia --------
  async postScan(payload) {
    return fetchJson(`${BASE}/checkin/scan`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async postIncident(payload) {
    const url = `${ROOT}/incidentes`;
    return fetchJson(url, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async updateIncident(id, payload) {
    const url = `${ROOT}/incidentes/${encodeURIComponent(id)}`;
    return fetchJson(url, {
      method: "PUT",
      body: JSON.stringify(payload || {}),
    });
  },

  async panic(gps) {
    const input =
      gps && typeof gps === "object"
        ? "gps" in gps
          ? gps
          : { gps }
        : { gps: null };

    const lat = Number(input?.gps?.lat);
    const lon = Number(input?.gps?.lon);

    const body = { ...input };

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      body.gps = { lat, lon };
      body.loc = { type: "Point", coordinates: [lon, lat] };
    } else {
      delete body.loc;
      body.gps = input?.gps ?? null;
    }

    const urls = [
      `${BASE}/checkin/panic`,
      `${BASE}/panic`,
      `${ROOT}/rondasqr/panic`,
      `${ROOT}/panic`,
    ];

    let lastErr;
    for (const url of urls) {
      try {
        return await fetchJson(url, { method: "POST", body: JSON.stringify(body) });
      } catch (err) {
        lastErr = err;
        if (err.status !== 404 && err.status !== 405) break;
      }
    }

    throw lastErr || new Error("No se pudo enviar el pánico: ninguna ruta coincidió");
  },

  async postInactivity(payload) {
    return fetchJson(`${BASE}/checkin/inactivity`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async postFall(payload) {
    return fetchJson(`${BASE}/checkin/fall`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  // -------- OFFLINE --------
  async offlineCheckin(item) {
    return fetchJson(`${BASE}/offline/checkin`, {
      method: "POST",
      body: JSON.stringify(item || {}),
    });
  },

  async offlineDump(payload) {
    return fetchJson(`${BASE}/offline/dump`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  // -------- Admin CRUD --------
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

  // Rondas
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

  // Puntos
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
      method: "PATCH",
      body: JSON.stringify(body || {}),
    });
  },

  async deletePoint(id) {
    return fetchJson(`${BASE}/admin/points/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async reorderPoints(roundId, pointIds) {
    return fetchJson(`${BASE}/admin/points/reorder`, {
      method: "PUT",
      body: JSON.stringify({ roundId, pointIds }),
    });
  },

  /* =========================================================
     QR helpers
  ========================================================= */
  pointQrPngUrl(id) {
    if (!id) return "";
    return `${BASE}/admin/points/${encodeURIComponent(id)}/qr.png`;
  },

  pointQrPdfUrl(id) {
    if (!id) return "";
    return `${BASE}/admin/points/${encodeURIComponent(id)}/qr.pdf`;
  },

  async rotatePointQr(id) {
    if (!id) throw new Error("id requerido");
    return fetchJson(`${BASE}/admin/points/${encodeURIComponent(id)}/rotate-qr`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async deletePointQr(id) {
    if (!id) throw new Error("id requerido");

    return fetchJson(`${BASE}/admin/points/${encodeURIComponent(id)}/qr`, {
      method: "DELETE",
    });
  },

  async listQrRepo(params = {}) {
    const qs = toQS(params);
    return fetchJson(`${BASE}/admin/qr-repo${qs ? `?${qs}` : ""}`);
  },

  qrRepoUrl(params = {}) {
    const qs = toQS({ ...params, format: "html" });
    return `${BASE}/admin/qr-repo${qs ? `?${qs}` : ""}`;
  },

  // -------- Plans --------
  async getPlan(q = {}) {
    const qs = toQS(q);
    return fetchJson(`${BASE}/admin/plans${qs ? `?${qs}` : ""}`);
  },

  async createOrUpdatePlan(body) {
    const base = normalizePlanBody(body);

    if (!base.siteId || !base.roundId) {
      const e = new Error("siteId y roundId son requeridos");
      e.status = 400;
      e.payload = { errors: { siteId: !base.siteId, roundId: !base.roundId } };
      throw e;
    }

    if (!Array.isArray(base.points) || base.points.length === 0) {
      const e = new Error("El plan debe contener al menos 1 punto");
      e.status = 400;
      e.payload = { errors: { points: "vacío" } };
      throw e;
    }

    const extras = {};
    for (const k of ["shift", "turno", "name", "label", "description", "notes"]) {
      if (body[k] != null && body[k] !== "") extras[k] = body[k];
    }

    const pointIds = base.points.map((p) => String(p.pointId));
    const payload = { ...base, ...extras, pointIds };

    const res = await fetchJson(`${BASE}/admin/plans`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return res == null
      ? this.getPlan({ siteId: base.siteId, roundId: base.roundId })
      : res;
  },

  async deletePlanByQuery(q = {}) {
    const qs = toQS(q);
    return fetchJson(`${BASE}/admin/plans${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
    });
  },

  async listPlans(q = {}) {
    return this.getPlan(q);
  },

  async createPlan(body) {
    return this.createOrUpdatePlan(body);
  },

  async updatePlan(_, body) {
    return this.createOrUpdatePlan(body);
  },

  async deletePlan(arg) {
    if (arg && typeof arg === "object") return this.deletePlanByQuery(arg);
    const e = new Error("deletePlan(id) no soportado; usa deletePlanByQuery({siteId, roundId})");
    e.status = 400;
    throw e;
  },

  // -------- Asignaciones --------
  async listAssignments(date) {
    const qs = toQS(date ? { date } : {});
    return fetchJson(`${BASE}/admin/assignments${qs ? `?${qs}` : ""}`);
  },

  async createAssignment(payload) {
    return fetchJson(`${BASE}/admin/assignments`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async deleteAssignment(id) {
    return fetchJson(`${BASE}/admin/assignments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // alias para ScanPage
  async checkinScan(payload) {
    return this.postScan(payload);
  },

  async scan(payload) {
    return this.postScan(payload);
  },
};

export default rondasqrApi;