// client/src/iam/api/iamApi.js
import { API, getToken, setToken, clearToken } from "../../lib/api.js";

const API_ROOT = String(API || "").replace(/\/$/, "");
const V1 = `${API_ROOT}/iam/v1`;

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
  } = {}
) {
  const urlBase = buildUrl(path);

  const headers = {};
  headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
  headers["Pragma"] = "no-cache";

  // ✅ Token: param > storage
  const bearer = token || getToken() || null;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  // ✅ Content-Type solo si es JSON y body es “json serializable”
  const sendingForm = isFormData(body);
  const sendingBinary = isBlob(body) || isArrayBuffer(body);

  const shouldJson =
    json &&
    !sendingForm &&
    !sendingBinary &&
    body !== undefined &&
    body !== null;

  if (shouldJson) {
    headers["Content-Type"] = "application/json";
  }

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

  if (!r.ok) {
    throw makeError(r, payload, textFallback);
  }

  return payload ?? { ok: true, text: textFallback };
}

/* =========================
   Helpers: catálogos (compat /catalogos vs /catalogs)
========================= */

async function reqCatalogs(pathEs, pathEn, token) {
  // intenta ES, luego EN
  try {
    return await req(pathEs, { token });
  } catch (e1) {
    // si es 404 o "Not implemented", intenta inglés
    const status = e1?.status;
    const msg = String(e1?.message || "");
    const couldFallback = status === 404 || /not implemented/i.test(msg);
    if (!couldFallback) throw e1;
    return await req(pathEn, { token });
  }
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

    // Esperado: { ok:true, token:"...", mustChangePassword:false }
    if (data?.token) setToken(data.token);

    return data;
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
     Catálogos (backend)
     ✅ compat:
     - /catalogos/... (ES viejo)
     - /catalogs/...  (EN nuevo)
  ========================= */

  // individuales
  getCivilStatusCatalog(token) {
    return reqCatalogs("/catalogos/estado-civil", "/catalogs/civil-status", token);
  },
  getCountriesCatalog(token) {
    return reqCatalogs("/catalogos/paises", "/catalogs/countries", token);
  },
  getProfessionsCatalog(token) {
    return reqCatalogs("/catalogos/profesiones", "/catalogs/professions", token);
  },

  // todo junto
  getAllCatalogs(token) {
    return reqCatalogs("/catalogos/todos", "/catalogs/all", token);
  },

  // helper canónico: devuelve SIEMPRE {ok, estadosCiviles, countries, profesiones}
  async getCatalogs(token) {
    // 1) intenta todo junto (ES/EN)
    try {
      const r = await this.getAllCatalogs(token);

      // soporta:
      // - { ok:true, items:{ civilStatus:[], countries:[], professions:[] } }
      // - { civilStatus:[], countries:[], professions:[] }
      // - { estadosCiviles:[], countries:[], profesiones:[] }
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
      // 2) fallback: pedir individuales
      const asArray = (x) =>
        Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : [];

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
    return req(`/roles/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: body || {},
      token,
    });
  },
  deleteRole(id, token) {
    return req(`/roles/${encodeURIComponent(id)}`, { method: "DELETE", token });
  },

  // Permisos por rol (canónico)
  getRolePerms(id, token) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, { token });
  },
  setRolePerms(id, permissionKeys, token) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, {
      method: "PUT",
      body: {
        permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : [],
      },
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
      body: {
        permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : [],
      },
      token,
    });
  },

  // Permisos
  listPerms(params = {}, token) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === "" || v == null) return;
      qs.set(k, String(v));
    });
    const q = qs.toString();
    return req(`/permissions${q ? `?${q}` : ""}`, { token });
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
    return req(`/permissions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
    });
  },

  // Usuarios
  listUsers(q = "", token) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return req(`/users${qs}`, { token });
  },
  listGuards(q = "", active = true, token) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
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
    return req(`/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: body || {},
      token,
    });
  },
  enableUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}/enable`, {
      method: "POST",
      body: {},
      token,
    });
  },
  disableUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}/disable`, {
      method: "POST",
      body: {},
      token,
    });
  },
  deleteUser(id, token) {
    return req(`/users/${encodeURIComponent(id)}`, { method: "DELETE", token });
  },

  // Audit
  listAudit(params = {}, token) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === "" || v == null) return;
      qs.set(k, String(v));
    });
    const s = qs.toString();
    return req(`/audit${s ? `?${s}` : ""}`, { token });
  },
};

export default iamApi;