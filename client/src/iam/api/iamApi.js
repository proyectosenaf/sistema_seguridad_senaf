// client/src/iam/api/iamApi.js

// Si NO defines VITE_API_BASE_URL, usará rutas relativas -> ideal con proxy de Vite.
const ROOT = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// Bases en orden de preferencia
const V1         = `${ROOT}/api/iam/v1`;
const LEGACY_IAM = `${ROOT}/api/iam`;
const LEGACY_API = `${ROOT}/api`;

const DEBUG = import.meta.env.VITE_IAM_DEBUG === "1";

/** Lee identidad DEV desde localStorage o .env */
function getDevIdentity() {
  const email =
    (typeof localStorage !== "undefined" && localStorage.getItem("iamDevEmail")) ||
    import.meta.env.VITE_DEV_IAM_EMAIL ||
    "";
  const roles =
    (typeof localStorage !== "undefined" && localStorage.getItem("iamDevRoles")) ||
    import.meta.env.VITE_DEV_IAM_ROLES ||
    "";
  const perms =
    (typeof localStorage !== "undefined" && localStorage.getItem("iamDevPerms")) ||
    import.meta.env.VITE_DEV_IAM_PERMS ||
    "";
  return { email: email.trim(), roles: roles.trim(), perms: perms.trim() };
}

function isCrossOrigin(urlStr) {
  try {
    // Si ROOT es vacío (proxy), url será relativa => mismo origen
    const u = new URL(urlStr, window.location.href);
    return u.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Construye headers:
 * - Si hay token → Authorization
 * - Si el body es FormData → no fijar Content-Type
 * - En dev: añade x-user-* cuando no haya token o cuando VITE_FORCE_DEV_IAM=1
 *   PERO los omite en escrituras cross-origin (POST/PATCH/PUT/DELETE) para evitar CORS.
 */
function buildHeaders({ token, isFormData, method = "GET", urlForCors } = {}) {
  const h = {};
  if (!isFormData) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;

  const FORCE_DEV = import.meta.env.VITE_FORCE_DEV_IAM === "1";
  const shouldSendDev = FORCE_DEV || !token;

  const write = ["POST", "PATCH", "PUT", "DELETE"].includes((method || "GET").toUpperCase());
  const cross = isCrossOrigin(urlForCors || V1);

  if (shouldSendDev && !(write && cross)) {
    const { email, roles, perms } = getDevIdentity();
    if (email) h["x-user-email"] = email;
    if (roles) h["x-roles"] = roles;
    if (perms) h["x-perms"] = perms;
  }

  if (DEBUG) {
    const log = { ...h };
    if (log.Authorization) log.Authorization = "(set)";
    console.log("[iamApi] headers:", log, "method:", method, "url:", urlForCors);
  }
  return h;
}

async function toJson(resp) {
  try { return await resp.json(); } catch { return {}; }
}

/** fetch con manejo de errores de red/CORS más claro */
async function rawFetch(url, { method = "GET", body, token, formData = false } = {}) {
  const isFD = formData || (typeof FormData !== "undefined" && body instanceof FormData);
  try {
    const r = await fetch(url, {
      method,
      credentials: "include",
      headers: buildHeaders({ token, isFormData: isFD, method, urlForCors: url }),
      body: body ? (isFD ? body : JSON.stringify(body)) : undefined,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      const msg = text || `${r.status} ${r.statusText}`;
      throw new Error(msg);
    }
    return toJson(r);
  } catch (e) {
    // TypeError casi siempre = CORS / red
    if (e?.name === "TypeError") {
      throw new Error(
        "No se pudo conectar con la API. Revisa que el servidor esté arriba, " +
        "el CORS permita este método y cabeceras, y que la URL VITE_API_BASE_URL sea correcta."
      );
    }
    throw e;
  }
}

/** Intenta varias rutas candidatas hasta que una responda OK */
async function reqAny(paths, opts) {
  let lastErr;
  for (const p of paths) {
    try {
      if (DEBUG) console.log("[iamApi] try:", p, opts?.method || "GET");
      return await rawFetch(p, opts);
    } catch (e) {
      lastErr = e;
      if (DEBUG) console.warn("[iamApi] fail:", p, e?.message || e);
    }
  }
  throw lastErr || new Error("No se pudo completar la solicitud");
}

/** Helpers de caminos por recurso */
const PATHS = {
  perms: {
    list:     () => [`${V1}/permissions`, `${LEGACY_IAM}/permissions`, `${LEGACY_API}/permissions`],
    create:   () => [`${V1}/permissions`, `${LEGACY_IAM}/permissions`, `${LEGACY_API}/permissions`],
    byId: (id)=> [`${V1}/permissions/${id}`, `${LEGACY_IAM}/permissions/${id}`, `${LEGACY_API}/permissions/${id}`],
  },
  roles: {
    list:     () => [`${V1}/roles`, `${LEGACY_IAM}/roles`, `${LEGACY_API}/roles`],
    create:   () => [`${V1}/roles`, `${LEGACY_IAM}/roles`, `${LEGACY_API}/roles`],
    byId: (id)=> [`${V1}/roles/${id}`, `${LEGACY_IAM}/roles/${id}`, `${LEGACY_API}/roles/${id}`],
  },
  users: {
    list:   (q) => {
      const search = q ? `?q=${encodeURIComponent(q)}` : "";
      return [
        `${V1}/users${search}`,
        `${LEGACY_IAM}/users${search}`,
        `${LEGACY_API}/users${search}`,
      ];
    },
    create:   () => [`${V1}/users`, `${LEGACY_IAM}/users`, `${LEGACY_API}/users`],
    byId: (id)=> [`${V1}/users/${id}`, `${LEGACY_IAM}/users/${id}`, `${LEGACY_API}/users/${id}`],
    enable: (id)=> [`${V1}/users/${id}/enable`, `${LEGACY_IAM}/users/${id}/enable`, `${LEGACY_API}/users/${id}/enable`],
    disable:(id)=> [`${V1}/users/${id}/disable`,`${LEGACY_IAM}/users/${id}/disable`,`${LEGACY_API}/users/${id}/disable`],
  },
};

export const iamApi = {
  /** /auth/me con fallback a /me (v1 y legacy) */
  async me(token) {
    const headers = buildHeaders({ token, isFormData: false, method: "GET" });
    const candidates = [
      `${V1}/auth/me`, `${V1}/me`,
      `${LEGACY_IAM}/auth/me`, `${LEGACY_IAM}/me`,
      `${LEGACY_API}/auth/me`, `${LEGACY_API}/me`,
    ];
    for (const url of candidates) {
      try {
        const r = await fetch(url, { headers, credentials: "include" });
        if (r.ok) return toJson(r);
      } catch (e) {
        if (DEBUG) console.warn("[iamApi.me] fallo:", url, e?.message || e);
      }
    }
    throw new Error("No se pudo obtener /me");
  },

  // ---- Permisos
  listPerms:   (t)        => reqAny(PATHS.perms.list(),   { token: t }),
  createPerm:  (p, t)     => reqAny(PATHS.perms.create(), { method: "POST", body: p, token: t }),
  updatePerm:  (id, p, t) => reqAny(PATHS.perms.byId(id), { method: "PATCH", body: p, token: t }),
  deletePerm:  (id, t)    => reqAny(PATHS.perms.byId(id), { method: "DELETE", token: t }),

  // ---- Roles
  listRoles:   (t)        => reqAny(PATHS.roles.list(),   { token: t }),
  createRole:  (p, t)     => reqAny(PATHS.roles.create(), { method: "POST", body: p, token: t }),
  updateRole:  (id, p, t) => reqAny(PATHS.roles.byId(id), { method: "PATCH", body: p, token: t }),
  deleteRole:  (id, t)    => reqAny(PATHS.roles.byId(id), { method: "DELETE", token: t }),

  // ---- Usuarios
  listUsers:   (q = "", t)=> reqAny(PATHS.users.list(q),   { token: t }),
  createUser:  (p, t)     => reqAny(PATHS.users.create(),  { method: "POST", body: p, token: t }),
  updateUser:  (id, p, t) => reqAny(PATHS.users.byId(id),  { method: "PATCH", body: p, token: t }),
  enableUser:  (id, t)    => reqAny(PATHS.users.enable(id),  { method: "POST", token: t }),
  disableUser: (id, t)    => reqAny(PATHS.users.disable(id), { method: "POST", token: t }),

  // ---- Auditoría (tolerante a 404)
  async listAudit(limit = 100, token) {
    try {
      return await reqAny(
        [
          `${V1}/audit?limit=${encodeURIComponent(limit)}`,
          `${LEGACY_IAM}/audit?limit=${encodeURIComponent(limit)}`,
          `${LEGACY_API}/audit?limit=${encodeURIComponent(limit)}`,
        ],
        { token }
      );
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("404")) return { ok: false, items: [] };
      throw e;
    }
  },

  // ---- Import Excel (FormData)
  importExcel(file, token) {
    const fd = new FormData();
    fd.append("file", file);
    return reqAny(
      [`${V1}/import/excel`, `${LEGACY_IAM}/import/excel`, `${LEGACY_API}/import/excel`],
      { method: "POST", body: fd, token, formData: true }
    );
  },
};

export default iamApi;
