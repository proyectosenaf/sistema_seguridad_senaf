// client/src/iam/api/iamApi.js
import { API, getToken, setToken, clearToken } from "../../lib/api.js";

const API_ROOT = String(API || "").replace(/\/$/, "");
const V1 = `${API_ROOT}/iam/v1`;

// ✅ NEW: base para endpoints públicos (OTP)
// Tu server monta: /api/public/v1/auth  y también /public/v1/auth
// Como API_ROOT normalmente termina en "/api", construimos PUBLIC_AUTH_BASE desde ahí.
const PUBLIC_AUTH_BASE = `${API_ROOT.replace(/\/api\/?$/, "")}/api/public/v1/auth`;

/* =========================
   Helpers
========================= */
async function toJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

async function toText(resp) {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

function isFormData(x) {
  return typeof FormData !== "undefined" && x instanceof FormData;
}

function isBlob(x) {
  return typeof Blob !== "undefined" && x instanceof Blob;
}

function isArrayBuffer(x) {
  return typeof ArrayBuffer !== "undefined" && x instanceof ArrayBuffer;
}

function buildUrl(path) {
  return `${V1}${path.startsWith("/") ? path : `/${path}`}`;
}

// ✅ NEW: construir URL para rutas públicas (OTP)
function buildPublicAuthUrl(path) {
  return `${PUBLIC_AUTH_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function makeError(r, payload, fallbackText = "") {
  const msg =
    payload?.message ||
    payload?.error ||
    payload?.details ||
    (fallbackText ? fallbackText.slice(0, 300) : "") ||
    `${r.status} ${r.statusText}`;

  const err = new Error(msg);
  err.status = r.status;
  err.payload = payload;
  return err;
}

/**
 * req()
 * - token: param > localStorage (getToken)
 * - json=true: set Content-Type + stringify
 * - si body es FormData/Blob/ArrayBuffer: no setear Content-Type
 * - timeoutMs: abort fetch si excede
 *
 * ✅ NEW:
 * - isPublicAuth=true => llama a /api/public/v1/auth (OTP)
 */
async function req(
  path,
  {
    method = "GET",
    body,
    json = true,
    token,
    credentials = "omit",
    timeoutMs = 30000,
    isPublicAuth = false, // ✅ NEW
  } = {}
) {
  const urlBase = isPublicAuth ? buildPublicAuthUrl(path) : buildUrl(path); // ✅ NEW

  const headers = {};
  headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
  headers["Pragma"] = "no-cache";

  // ✅ Token: param > storage
  const bearer = token || getToken() || null;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  // ✅ Content-Type solo si es JSON y body es “json serializable”
  const sendingForm = isFormData(body);
  const sendingBinary = isBlob(body) || isArrayBuffer(body);
  const shouldJson = json && !sendingForm && !sendingBinary && body !== undefined && body !== null;

  if (shouldJson) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOpts = {
    method,
    credentials,
    headers,
    cache: "no-store",
    signal: controller.signal,
    body:
      body === undefined || body === null
        ? undefined
        : shouldJson
        ? JSON.stringify(body)
        : body,
  };

  let r;
  try {
    r = await fetch(urlBase, fetchOpts);
  } catch (e) {
    const msg =
      e?.name === "AbortError"
        ? `Timeout (${timeoutMs}ms) en ${method} ${path}`
        : e?.message || "Network error";
    const err = new Error(msg);
    err.status = 0;
    err.payload = { error: "network_error", message: msg };
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // workaround para caches/proxies que devuelven 304
  if (r.status === 304) {
    const sep = urlBase.includes("?") ? "&" : "?";
    const urlNoCache = `${urlBase}${sep}_ts=${Date.now()}`;

    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
    try {
      r = await fetch(urlNoCache, { ...fetchOpts, signal: controller2.signal });
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? `Timeout (${timeoutMs}ms) en ${method} ${path} (retry 304)`
          : e?.message || "Network error";
      const err = new Error(msg);
      err.status = 0;
      err.payload = { error: "network_error", message: msg };
      throw err;
    } finally {
      clearTimeout(timer2);
    }
  }

  // 204 No Content
  if (r.status === 204) return { ok: true };

  // intenta JSON, si no hay, intenta texto
  const payload = await toJson(r);
  const textFallback = payload ? "" : await toText(r);

  if (!r.ok) throw makeError(r, payload, textFallback);

  return payload ?? { ok: true, text: textFallback };
}

/* =========================
   Helpers: catálogos (compat /catalogos vs /catalogs)
========================= */
async function reqCatalogs(pathEs, pathEn, token) {
  try {
    return await req(pathEs, { token });
  } catch (e1) {
    const status = e1?.status;
    const msg = String(e1?.message || "");
    const couldFallback = status === 404 || /not implemented/i.test(msg);
    if (!couldFallback) throw e1;
    return await req(pathEn, { token });
  }
}

function buildQueryString(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === "" || v == null) return;
    qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Normaliza enteros seguros (para limit/skip) */
function toInt(v, def = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

/** Normaliza booleano a 0/1 */
function to01(v, def = 0) {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return 1;
  if (["0", "false", "no", "n", "off"].includes(s)) return 0;
  return def;
}

/* =========================
   API
========================= */
export const iamApi = {
  // Auth / Session
  me(token) {
    return req("/me", { token, method: "GET", credentials: "omit" });
  },

  // Login local: guarda token automáticamente
  async loginLocal({ email, password }) {
    const data = await req("/auth/login", {
      method: "POST",
      body: {
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
      },
      credentials: "omit",
    });

    if (data?.token) setToken(data.token);
    return data;
  },

  // ✅ NEW: OTP request (primer login para TODOS)
  // Server: POST /api/public/v1/auth/otp/request
  requestOtp(email) {
    return req("/otp/request", {
      method: "POST",
      body: { email: String(email || "").trim().toLowerCase() },
      credentials: "omit",
      isPublicAuth: true,
    });
  },

  // ✅ NEW: OTP verify (devuelve token y lo guardamos)
  // Server: POST /api/public/v1/auth/otp/verify
  async verifyOtp(email, code) {
    const data = await req("/otp/verify", {
      method: "POST",
      body: {
        email: String(email || "").trim().toLowerCase(),
        code: String(code || "").trim(),
      },
      credentials: "omit",
      isPublicAuth: true,
    });

    if (data?.token) setToken(data.token);
    return data;
  },

  // ✅ NEW: set password para usuarios internos (no-visita)
  // Endpoint típico: POST /api/iam/v1/auth/set-password
  // (Si tu ruta se llama distinto, dime el path real y lo ajusto)
  setPassword(newPassword, token) {
    return req("/auth/set-password", {
      method: "POST",
      body: { password: String(newPassword || "") },
      token,
      credentials: "omit",
    });
  },

  // Logout
  async logout() {
    const out = await req("/auth/logout", {
      method: "POST",
      body: {},
      credentials: "omit",
    });
    clearToken();
    return out;
  },

  /* =========================
     Catálogos
  ========================= */
  getCivilStatusCatalog(token) {
    return reqCatalogs("/catalogos/estado-civil", "/catalogs/civil-status", token);
  },
  getCountriesCatalog(token) {
    return reqCatalogs("/catalogos/paises", "/catalogs/countries", token);
  },
  getProfessionsCatalog(token) {
    return reqCatalogs("/catalogos/profesiones", "/catalogs/professions", token);
  },
  getAllCatalogs(token) {
    return reqCatalogs("/catalogos/todos", "/catalogs/all", token);
  },

  async getCatalogs(token) {
    try {
      const r = await this.getAllCatalogs(token);

      const src =
        r?.items && typeof r.items === "object" && !Array.isArray(r.items) ? r.items : r;

      const estadosCiviles = src?.estadosCiviles || src?.civilStatus || src?.civil || [];
      const countries = src?.countries || src?.paises || [];
      const profesiones = src?.profesiones || src?.professions || src?.oficios || [];

      return {
        ok: true,
        estadosCiviles: Array.isArray(estadosCiviles) ? estadosCiviles : [],
        countries: Array.isArray(countries) ? countries : [],
        profesiones: Array.isArray(profesiones) ? profesiones : [],
        raw: r,
      };
    } catch (e) {
      const asArray = (x) => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : []);

      const [civil, ctys, prof] = await Promise.allSettled([
        this.getCivilStatusCatalog(token),
        this.getCountriesCatalog(token),
        this.getProfessionsCatalog(token),
      ]);

      return {
        ok: true,
        estadosCiviles: civil.status === "fulfilled" ? asArray(civil.value) : [],
        countries: ctys.status === "fulfilled" ? asArray(ctys.value) : [],
        profesiones: prof.status === "fulfilled" ? asArray(prof.value) : [],
        raw: { error: e?.message || String(e || "catalog error") },
      };
    }
  },

  // Roles
  listRoles(token) {
    return req("/roles", { token });
  },
  createRole(body, token) {
    return req("/roles", { method: "POST", body: body || {}, token });
  },
  updateRole(id, body, token) {
    return req(`/roles/${encodeURIComponent(id)}`, { method: "PATCH", body: body || {}, token });
  },
  deleteRole(id, token) {
    return req(`/roles/${encodeURIComponent(id)}`, { method: "DELETE", token });
  },

  // Permisos por rol
  getRolePerms(id, token) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, { token });
  },
  setRolePerms(id, permissionKeys, token) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, {
      method: "PUT",
      body: { permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : [] },
      token,
    });
  },

  // Aliases (compat)
  listPermsForRole(id, token) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, { token });
  },
  setPermsForRole(id, permissionKeys, token) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, {
      method: "PUT",
      body: { permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : [] },
      token,
    });
  },

  // Permisos
  listPerms(params = {}, token) {
    return req(`/permissions${buildQueryString(params)}`, { token });
  },
  createPerm(body, token) {
    return req("/permissions", { method: "POST", body: body || {}, token });
  },
  updatePerm(id, body, token) {
    return req(`/permissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: body || {},
      token,
    });
  },
  deletePerm(id, token) {
    return req(`/permissions/${encodeURIComponent(id)}`, { method: "DELETE", token });
  },

  // =========================
  // Usuarios
  // =========================

  /**
   * listUsers()
   * ✅ Backward compatible:
   *  - listUsers("texto", token) -> usa q=texto, default onlyActive=1, limit=5, skip=0
   * ✅ Nuevo:
   *  - listUsers({ q, onlyActive, limit, skip, createdFrom, createdTo }, token)
   */
  listUsers(qOrParams = "", token) {
    // defaults seguros (para evitar "me trae todo")
    const DEFAULT_ONLY_ACTIVE = 1;
    const DEFAULT_LIMIT = 5;
    const DEFAULT_SKIP = 0;

    // modo viejo: string => q
    if (typeof qOrParams === "string") {
      const q = String(qOrParams || "").trim();

      // por compat: si buscas algo, por default amplía el limit a 2000
      const limit = q ? 2000 : DEFAULT_LIMIT;

      const params = {
        q,
        onlyActive: DEFAULT_ONLY_ACTIVE,
        limit,
        skip: DEFAULT_SKIP,
      };

      return req(`/users${buildQueryString(params)}`, { token });
    }

    // modo nuevo: params object (normalizado)
    const p = qOrParams && typeof qOrParams === "object" ? qOrParams : {};

    const params = {
      q: String(p.q || "").trim(),
      onlyActive: to01(p.onlyActive, DEFAULT_ONLY_ACTIVE),
      limit: Math.max(1, Math.min(2000, toInt(p.limit, DEFAULT_LIMIT))),
      skip: Math.max(0, toInt(p.skip, DEFAULT_SKIP)),
      createdFrom: p.createdFrom || "",
      createdTo: p.createdTo || "",
    };

    return req(`/users${buildQueryString(params)}`, { token });
  },

  listGuards(q = "", active = true, token) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", String(q).trim());

    // ✅ si active=true manda active=1, si active=false no manda nada
    if (active) qs.set("active", "1");

    const s = qs.toString();
    return req(`/users/guards${s ? `?${s}` : ""}`, { token });
  },

  getUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}`, { token });
  },

  createUser(body, token) {
    return req("/users", { method: "POST", body: body || {}, token });
  },

  updateUser(id, body, token) {
    return req(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: body || {}, token });
  },

  enableUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}/enable`, { method: "POST", body: {}, token });
  },

  disableUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}/disable`, { method: "POST", body: {}, token });
  },

  deleteUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}`, { method: "DELETE", token });
  },

  // Audit
  listAudit(params = {}, token) {
    return req(`/audit${buildQueryString(params)}`, { token });
  },
};

export default iamApi;