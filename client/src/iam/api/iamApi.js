// client/src/iam/api/iamApi.js
import { API } from "../../lib/api.js";

const API_ROOT = String(API || "").replace(/\/$/, "");
const V1 = `${API_ROOT}/iam/v1`;

async function toJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * fetch base:
 * - por defecto incluye cookies (HttpOnly)
 * - agrega Authorization Bearer si hay token (param o localStorage)
 */
async function req(
  path,
  { method = "GET", body, json = true, token, credentials = "include" } = {}
) {
  const url = `${V1}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {};
  if (json) headers["Content-Type"] = "application/json";

  // token explícito o token local
  const bearer =
    token ||
    localStorage.getItem("senaf_token") ||
    localStorage.getItem("token") ||
    null;

  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const r = await fetch(url, {
    method,
    credentials,
    headers,
    body: body ? (json ? JSON.stringify(body) : body) : undefined,
  });

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
  loginLocal({ email, password }) {
    return req("/auth/login", {
      method: "POST",
      body: {
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
      },
      credentials: "omit", // normalmente login local no depende de cookie previa
    });
  },
  logout() {
    return req("/auth/logout", { method: "POST", body: {} });
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
    return req(`/permissions/${encodeURIComponent(id)}`, { method: "PATCH", body: body || {}, token });
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
