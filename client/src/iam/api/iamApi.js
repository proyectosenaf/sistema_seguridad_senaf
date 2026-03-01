// client/src/iam/api/iamApi.js
import { API, getToken, setToken, clearToken } from "../../lib/api.js";

const API_ROOT = String(API || "").replace(/\/$/, "");
const V1 = `${API_ROOT}/iam/v1`;

async function toJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

async function req(
  path,
  { method = "GET", body, json = true, token, credentials = "omit" } = {}
) {
  const urlBase = `${V1}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {};
  if (json) headers["Content-Type"] = "application/json";

  headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
  headers["Pragma"] = "no-cache";

  // ✅ Token canónico: param > localStorage(senaf_token)
  const bearer = token || getToken() || null;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const fetchOpts = {
    method,
    credentials, // ✅ por defecto omit (JWT por header). Si algún endpoint usa cookies, pásalo explícito.
    headers,
    cache: "no-store",
    body: body ? (json ? JSON.stringify(body) : body) : undefined,
  };

  let r = await fetch(urlBase, fetchOpts);

  // workaround para caches/proxies que devuelven 304 en dev
  if (r.status === 304) {
    const sep = urlBase.includes("?") ? "&" : "?";
    const urlNoCache = `${urlBase}${sep}_ts=${Date.now()}`;
    r = await fetch(urlNoCache, fetchOpts);
  }

  if (!r.ok) {
    const payload = await toJson(r);
    const err = new Error(payload?.message || payload?.error || `${r.status} ${r.statusText}`);
    err.status = r.status;
    err.payload = payload;
    throw err;
  }

  return toJson(r);
}

export const iamApi = {
  // Auth
  me(token) {
    return req("/me", { token });
  },

  // ✅ login local: guarda token canónico automáticamente
  async loginLocal({ email, password }) {
    const data = await req("/auth/login", {
      method: "POST",
      body: {
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
      },
      credentials: "omit",
    });

    // Respuesta esperada: { ok:true, token:"...", mustChangePassword:false }
    if (data?.token) setToken(data.token);

    return data;
  },

  // ✅ logout: limpia token canónico
  async logout() {
    // si tu backend no requiere token para logout, esto igual es seguro
    const out = await req("/auth/logout", { method: "POST", body: {}, credentials: "omit" });
    clearToken();
    return out;
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

  // ✅ NOMBRE CANÓNICO
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

  // ✅ ALIASES (para que tu RolesPage no reviente)
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
    return req(`/permissions/${encodeURIComponent(id)}`, { method: "DELETE", token });
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