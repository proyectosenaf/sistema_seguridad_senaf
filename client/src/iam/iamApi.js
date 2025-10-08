// client/src/iam/iamApi.js
const ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const V1 = `${ROOT}/api/iam/v1`;
const LEGACY = `${ROOT}/api/iam`;

// Genera headers: usa Bearer si hay token; si no, headers de DEV (x-roles/x-perms)
function makeHeaders(token) {
  if (token) return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const devEmail = import.meta.env.VITE_DEV_IAM_EMAIL || "dev@local";
  const devRoles = (import.meta.env.VITE_DEV_IAM_ROLES || "").trim(); // p.ej.: "admin,guardia"
  const devPerms = (import.meta.env.VITE_DEV_IAM_PERMS || "").trim(); // p.ej.: "*"

  const h = { "Content-Type": "application/json", "x-user-email": devEmail, "x-user-id": "dev-user" };
  if (devRoles) h["x-roles"] = devRoles;
  if (devPerms) h["x-perms"] = devPerms;
  return h;
}

const opts = ({ method = "GET", headers, body } = {}) => ({
  method,
  headers,
  credentials: "include",
  body: body ? JSON.stringify(body) : undefined,
});

const j = async (r) => {
  try { return await r.json(); } catch { return {}; }
};

async function req(path, { method = "GET", body, token } = {}) {
  const h = makeHeaders(token);

  // Intento v1
  try {
    const r1 = await fetch(`${V1}${path}`, opts({ method, headers: h, body }));
    if (r1.ok) return j(r1);
    if (![404, 405].includes(r1.status)) {
      throw new Error((await r1.text().catch(() => "")) || r1.statusText);
    }
  } catch { /* cae a legacy */ }

  // Fallback legacy
  const legacyPath = path.startsWith("/accounts") ? path.replace("/accounts", "/users") : path;
  const r2 = await fetch(`${LEGACY}${legacyPath}`, opts({ method, headers: h, body }));
  if (!r2.ok) throw new Error((await r2.text().catch(() => "")) || r2.statusText);
  return j(r2);
}

export const iamApi = {
  async me(token) {
    const h = makeHeaders(token);
    const candidates = [`${V1}/auth/me`, `${V1}/me`, `${LEGACY}/auth/me`, `${LEGACY}/me`];
    for (const u of candidates) {
      try {
        const r = await fetch(u, opts({ headers: h }));
        if (r.ok) return j(r);
      } catch { /* prueba siguiente */ }
    }
    throw new Error("No se pudo obtener /auth/me ni /me");
  },

  // Roles
  listRoles:        (t)        => req("/roles",               { token: t }),
  createRole:       (p, t)     => req("/roles",               { method: "POST",  body: p, token: t }),
  updateRole:       (id, p, t) => req(`/roles/${id}`,         { method: "PATCH", body: p, token: t }),
  deleteRole:       (id, t)    => req(`/roles/${id}`,         { method: "DELETE", token: t }),

  // Permisos
  listPermissions:  (t)        => req("/permissions",         { token: t }),
  createPermission: (p, t)     => req("/permissions",         { method: "POST",  body: p, token: t }),
  updatePermission: (id, p, t) => req(`/permissions/${id}`,   { method: "PATCH", body: p, token: t }),
  deletePermission: (id, force = false, t) =>
    req(`/permissions/${id}?force=${force ? "true" : "false"}`, { method: "DELETE", token: t }),
  renameGroup:      (from, to, t) =>
    req("/permissions/rename-group",                          { method: "POST", body: { from, to }, token: t }),
  deleteGroup:      (name, force = false, t) =>
    req(`/permissions/group/${encodeURIComponent(name)}?force=${force ? "true" : "false"}`, { method: "DELETE", token: t }),
  reorderPermissions: (group, ids, t) =>
    req("/permissions/reorder",                               { method: "POST", body: { group, ids }, token: t }),

  // Auditoría
  listAudit:        (limit = 50, t) => req(`/audit?limit=${encodeURIComponent(limit)}`, { token: t }),

  // Cuentas
  listAccounts:     (q = "", t)   => req(`/accounts${q ? `?q=${encodeURIComponent(q)}` : ""}`, { token: t }),
  createAccount:    (p, t)        => req("/accounts",            { method: "POST",  body: p, token: t }),
  updateAccount:    (id, p, t)    => req(`/accounts/${id}`,      { method: "PATCH", body: p, token: t }),
  setAccountRoles:  (id, roleIds, t) =>
    req(`/accounts/${id}/roles`,                             { method: "POST",  body: { roleIds }, token: t }),
  disableAccount:   (id, t)       => req(`/accounts/${id}/disable`, { method: "POST", token: t }),
  enableAccount:    (id, t)       => req(`/accounts/${id}/enable`,  { method: "POST", token: t }),
};
