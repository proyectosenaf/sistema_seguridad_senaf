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
 * - usa cookie de sesión (HttpOnly)
 * - NO usa Authorization
 * - NO usa headers DEV
 */
async function req(path, { method = "GET", body, json = true } = {}) {
  const url = `${V1}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {};
  if (json) headers["Content-Type"] = "application/json";

  const r = await fetch(url, {
    method,
    credentials: "include",
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
  me() {
    return req("/me");
  },
  loginLocal({ email, password }) {
    return req("/auth/login", {
      method: "POST",
      body: {
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
      },
    });
  },
  logout() {
    return req("/auth/logout", { method: "POST", body: {} });
  },

  // Roles
  listRoles() {
    return req("/roles");
  },
  createRole(body) {
    return req("/roles", { method: "POST", body: body || {} });
  },
  updateRole(id, body) {
    return req(`/roles/${encodeURIComponent(id)}`, { method: "PATCH", body: body || {} });
  },
  deleteRole(id) {
    return req(`/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  getRolePerms(id) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`);
  },
  setRolePerms(id, permissionKeys) {
    return req(`/roles/${encodeURIComponent(id)}/permissions`, {
      method: "PUT",
      body: { permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : [] },
    });
  },

  // Permisos
  listPerms(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === "" || v == null) return;
      qs.set(k, String(v));
    });
    const q = qs.toString();
    return req(`/permissions${q ? `?${q}` : ""}`);
  },
  createPerm(body) {
    return req("/permissions", { method: "POST", body: body || {} });
  },
  updatePerm(id, body) {
    return req(`/permissions/${encodeURIComponent(id)}`, { method: "PATCH", body: body || {} });
  },
  deletePerm(id) {
    return req(`/permissions/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // Usuarios
  listUsers(q = "") {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return req(`/users${qs}`);
  },
  listGuards(q = "", active = true) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (active) qs.set("active", "1");
    const s = qs.toString();
    return req(`/users/guards${s ? `?${s}` : ""}`);
  },
  createUser(body) {
    return req("/users", { method: "POST", body: body || {} });
  },
  updateUser(id, body) {
    return req(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: body || {} });
  },
  enableUser(id) {
    return req(`/users/${encodeURIComponent(id)}/enable`, { method: "POST", body: {} });
  },
  disableUser(id) {
    return req(`/users/${encodeURIComponent(id)}/disable`, { method: "POST", body: {} });
  },
  deleteUser(id) {
    return req(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // Audit
  listAudit(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === "" || v == null) return;
      qs.set(k, String(v));
    });
    const s = qs.toString();
    return req(`/audit${s ? `?${s}` : ""}`);
  },
};

export default iamApi;