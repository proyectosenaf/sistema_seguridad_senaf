// client/src/iam/api/iamApi.js
import { API } from "../../lib/api";

const V1 = `${API}/iam/v1`;
const DEBUG = import.meta.env.VITE_IAM_DEBUG === "1";

/** Identidad DEV (para cabeceras x-user-*) */
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

function buildHeaders({ token, isFormData, method = "GET", urlForCors } = {}) {
  const h = {};
  if (!isFormData) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;

  const FORCE_DEV = import.meta.env.VITE_FORCE_DEV_IAM === "1";
  const shouldSendDev = FORCE_DEV || !token;
  if (shouldSendDev) {
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
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await toJson(r);
        const msg = j?.error || j?.detail || j?.message || `${r.status} ${r.statusText}`;
        throw new Error(msg);
      }
      const text = await r.text().catch(() => "");
      throw new Error(text || `${r.status} ${r.statusText}`);
    }
    return toJson(r);
  } catch (e) {
    if (e?.name === "TypeError") {
      throw new Error("No se pudo conectar con la API. Revisa servidor, CORS y VITE_API_BASE_URL.");
    }
    throw e;
  }
}

/* ---------- RUTAS SOLO v1 ---------- */
const PATHS = {
  users: {
    list:   (q) => `${V1}/users${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    create: () => `${V1}/users`,
    byId:   (id) => `${V1}/users/${id}`,
    enable: (id) => `${V1}/users/${id}/enable`,
    disable:(id) => `${V1}/users/${id}/disable`,
  },
  roles: {
    list:        () => `${V1}/roles`,
    create:      () => `${V1}/roles`,
    byId:        (id) => `${V1}/roles/${id}`,
    permissions: (id) => `${V1}/roles/${id}/permissions`, // GET/PUT permisos del rol (keys)
  },
  perms: {
    list:        () => `${V1}/permissions`,
    create:      () => `${V1}/permissions`,
    byId:        (id) => `${V1}/permissions/${id}`,
    // Helper de listado anotado por rol (usa ?role=)
    listByRole:  (roleId) => `${V1}/permissions?role=${encodeURIComponent(roleId)}`,
  },
  auth: {
    me:     () => `${V1}/me`,
    login:  () => `${V1}/auth/login`, // login local opcional
  },
};

/* ---------- helpers de nombre/email ---------- */
function nameFromEmail(email) {
  const local = String(email || "").split("@")[0];
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Busca cualquier clave con "email" o "correo" (plano o 1 nivel)
function findEmailAny(obj) {
  const rx = /(email|correo)/i;
  const scan = (o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (rx.test(k) && typeof v === "string" && v.trim()) return v;
    }
    for (const [, v] of Object.entries(o || {})) {
      if (v && typeof v === "object") {
        for (const [kk, vv] of Object.entries(v)) {
          if (rx.test(kk) && typeof vv === "string" && vv.trim()) return vv;
        }
      }
    }
    return "";
  };
  return scan(obj);
}

function findNameAny(obj) {
  const direct =
    obj?.name ?? obj?.nombre ?? obj?.displayName ?? obj?.fullName ??
    obj?.razonSocial ?? obj?.contactName ?? "";

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const first =
    obj?.firstName ?? obj?.firstname ?? obj?.nombres ?? obj?.primerNombre ??
    obj?.persona?.nombres ?? obj?.persona?.firstName;
  const last  =
    obj?.lastName  ?? obj?.lastname  ?? obj?.apellidos ?? obj?.segundoNombre ??
    obj?.persona?.apellidos ?? obj?.persona?.lastName;

  const combo = `${first || ""} ${last || ""}`.trim();
  if (combo) return combo;

  if (obj?.persona?.nombre || obj?.persona?.name) {
    return (obj?.persona?.nombre || obj?.persona?.name || "").trim();
  }
  return "";
}

function fromFormData(fd) {
  const toObj = {};
  fd.forEach((v, k) => { toObj[k] = v; });
  return toObj;
}

/* ---------- API ---------- */
export const iamApi = {
  // Identidad
  async me(token) {
    const headers = buildHeaders({ token, isFormData: false, method: "GET" });
    try {
      const r = await fetch(PATHS.auth.me(), { headers, credentials: "include" });
      if (r.ok) return toJson(r);
    } catch (e) {
      if (DEBUG) console.warn("[iamApi.me] fallo:", e?.message || e);
    }
    throw new Error("No se pudo obtener /me");
  },

  // Login local (opcional, si usas auth propio además de Auth0)
  async loginLocal({ email, password }) {
    const body = {
      email: String(email || "").trim().toLowerCase(),
      password: String(password || ""),
    };
    return rawFetch(PATHS.auth.login(), { method: "POST", body });
  },

  // -------- Roles
  listRoles:   (t)            => rawFetch(PATHS.roles.list(),        { token: t }),
  createRole:  (p, t)         => rawFetch(PATHS.roles.create(),      { method: "POST", body: p, token: t }),
  updateRole:  (id, p, t)     => rawFetch(PATHS.roles.byId(id),      { method: "PATCH", body: p, token: t }),
  deleteRole:  (id, t)        => rawFetch(PATHS.roles.byId(id),      { method: "DELETE", token: t }),

  // Permisos de un rol (por KEYS) — NUEVO
  getRolePerms: (id, t)       => rawFetch(PATHS.roles.permissions(id),                 { token: t }),                 // -> { permissionKeys: string[] }
  setRolePerms: (id, keys, t) => rawFetch(PATHS.roles.permissions(id), { method: "PUT", body: { permissionKeys: keys }, token: t }),

  // -------- Permisos
  listPerms:   (t)            => rawFetch(PATHS.perms.list(),        { token: t }),
  // Listar permisos anotados para un rol — NUEVO
  listPermsForRole: (roleId, t) => rawFetch(PATHS.perms.listByRole(roleId), { token: t }),
  createPerm:  (p, t)         => rawFetch(PATHS.perms.create(),      { method: "POST",  body: p, token: t }),
  updatePerm:  (id, p, t)     => rawFetch(PATHS.perms.byId(id),      { method: "PATCH", body: p, token: t }),
  deletePerm:  (id, t)        => rawFetch(PATHS.perms.byId(id),      { method: "DELETE", token: t }),

  // -------- Usuarios
  listUsers:   (q = "", t)    => rawFetch(PATHS.users.list(q),       { token: t }),

  createUser:  (payload, t) => {
    let email = "", name = "", roles = [], active = true, perms, password;

    if (typeof FormData !== "undefined" && payload instanceof FormData) {
      const obj = fromFormData(payload);
      email = findEmailAny(obj);
      name  = findNameAny(obj);
      roles = obj.roles
        ? (Array.isArray(obj.roles) ? obj.roles : String(obj.roles).split(",").map(s => s.trim()).filter(Boolean))
        : [];
      active = obj.active !== undefined ? (obj.active === true || obj.active === "true") : true;
      if (obj.perms)    perms = Array.isArray(obj.perms) ? obj.perms : String(obj.perms).split(",").map(s=>s.trim()).filter(Boolean);
      // soporta alias de password
      password = obj.password ?? obj.clave ?? obj.contrasena ?? obj.contraseña ?? "";
    } else {
      const obj = payload || {};
      email = findEmailAny(obj) ||
        String(
          obj.email ?? obj.correo ?? obj.correoPersonal ?? obj.personalEmail ?? obj.mail ??
          obj?.persona?.email ?? obj?.persona?.correo ?? ""
        );
      name  = findNameAny(obj);
      roles = Array.isArray(obj.roles) ? obj.roles
        : (typeof obj.roles === "string" ? obj.roles.split(",").map(s=>s.trim()).filter(Boolean) : []);
      active = obj.active === undefined ? true : !!obj.active;
      if (obj.perms)    perms = Array.isArray(obj.perms) ? obj.perms : String(obj.perms).split(",").map(s=>s.trim()).filter(Boolean);
      password = obj.password ?? obj.clave ?? obj.contrasena ?? obj.contraseña ?? "";
    }

    email = String(email || "").trim().toLowerCase();
    name  = (String(name || "").trim()) || nameFromEmail(email);

    if (!email) {
      if (DEBUG) {
        console.warn("[iamApi.createUser] payload sin email. Keys:", payload instanceof FormData
          ? Array.from(payload.keys())
          : Object.keys(payload || {}));
      }
      return Promise.reject(new Error("email requerido"));
    }

    const body = {
      name, email, roles, active,
      ...(perms ? { perms } : {}),
      ...(password ? { password: String(password) } : {}), // opcional: crea hash en backend si viene
    };

    return rawFetch(PATHS.users.create(), { method: "POST", body, token: t });
  },

  updateUser:  (id, p, t) => rawFetch(PATHS.users.byId(id), { method: "PATCH", body: p, token: t }),
  enableUser:  (id, t)    => rawFetch(PATHS.users.enable(id),  { method: "POST", token: t }),
  disableUser: (id, t)    => rawFetch(PATHS.users.disable(id), { method: "POST", token: t }),

  // ⚠️ “Eliminar” usando desactivar (soft delete) porque DELETE /users/:id no existe en tu backend
  deleteUser:  (id, t)    => rawFetch(PATHS.users.disable(id), { method: "POST", token: t }),

  // Auditoría (tolerante a 404)
  async listAudit(limit = 100, token) {
    try {
      return await rawFetch(`${V1}/audit?limit=${encodeURIComponent(limit)}`, { token });
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("404")) return { ok: false, items: [] };
      throw e;
    }
  },

  // Import Excel (FormData)
  importExcel(file, token) {
    const fd = new FormData();
    fd.append("file", file);
    return rawFetch(`${V1}/import/excel`, { method: "POST", body: fd, token, formData: true });
  },
};

export default iamApi;
