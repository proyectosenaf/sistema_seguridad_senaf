// client/src/iam/api/iamApi.js
import { API } from "../../lib/api.js";

// Normaliza raíz de API para evitar dobles slashes
const API_ROOT = String(API || "").replace(/\/$/, "");
const V1 = `${API_ROOT}/iam/v1`;

const DEBUG = import.meta.env.VITE_IAM_DEBUG === "1";
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";
const FORCE_DEV = import.meta.env.VITE_FORCE_DEV_IAM === "1";

/* ─────────── provider de token tipo attachAuth0 ─────────── */
let tokenProvider = null;

export function attachIamAuth(fn) {
  tokenProvider = fn; // fn es async () => token | null
}

/** Identidad DEV (para cabeceras x-user-*) */
function getDevIdentity() {
  const email =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevEmail")) ||
    import.meta.env.VITE_DEV_IAM_EMAIL ||
    "";
  const roles =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevRoles")) ||
    import.meta.env.VITE_DEV_IAM_ROLES ||
    "";
  const perms =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("iamDevPerms")) ||
    import.meta.env.VITE_DEV_IAM_PERMS ||
    "*";
  return {
    email: email.trim(),
    roles: roles.trim(),
    perms: (perms || "*").trim(),
  };
}

/** slug simple para códigos de rol, etc. */
function slugify(str = "") {
  return String(str)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildHeaders({ token, isFormData, method = "GET", urlForCors } = {}) {
  const h = {};
  if (!isFormData) h["Content-Type"] = "application/json";

  // ✅ Token real (Auth0 / JWT)
  if (token) h.Authorization = `Bearer ${token}`;

  // DEV headers si:
  // - fuerzas modo dev, o
  // - no hay token y además la auth real está deshabilitada
  const shouldSendDev = FORCE_DEV || (!token && DISABLE_AUTH);
  if (shouldSendDev) {
    const { email, roles, perms } = getDevIdentity();
    if (email) h["x-user-email"] = email;
    if (roles) h["x-roles"] = roles;
    if (perms) h["x-perms"] = perms || "*";
  }

  if (DEBUG) {
    const log = { ...h };
    if (log.Authorization) log.Authorization = "(set)";
    console.log("[iamApi] headers:", log, "method:", method, "url:", urlForCors);
  }
  return h;
}

async function toJson(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

/** fetch con errores enriquecidos: err.status y err.payload */
async function rawFetch(
  url,
  { method = "GET", body, token, formData = false } = {}
) {
  const isFD =
    formData || (typeof FormData !== "undefined" && body instanceof FormData);

  // Si no nos pasaron token, intentamos usar el provider global
  if (!token && tokenProvider) {
    try {
      const autoToken = await tokenProvider();
      if (autoToken) token = autoToken;
    } catch (err) {
      if (DEBUG) {
        console.warn(
          "[iamApi] no se pudo obtener token desde tokenProvider:",
          err?.message || err
        );
      }
    }
  }

  try {
    const r = await fetch(url, {
      method,
      credentials: "include",
      headers: buildHeaders({
        token,
        isFormData: isFD,
        method,
        urlForCors: url,
      }),
      body: body ? (isFD ? body : JSON.stringify(body)) : undefined,
    });

    const contentType = r.headers.get("content-type") || "";
    const parse = async () =>
      contentType.includes("application/json")
        ? await toJson(r)
        : await r.text().catch(() => "");

    if (!r.ok) {
      const payload = await parse();
      const err = new Error(
        (payload && (payload.error || payload.detail || payload.message)) ||
          `${r.status} ${r.statusText}`
      );
      err.status = r.status;
      err.payload = payload;
      throw err;
    }

    if (contentType.includes("application/json")) return toJson(r);
    const text = await r.text().catch(() => "");
    return text || {};
  } catch (e) {
    if (e?.name === "TypeError") {
      const err = new Error(
        "No se pudo conectar con la API. Revisa servidor, CORS y VITE_API_BASE_URL."
      );
      err.status = 0;
      throw err;
    }
    throw e;
  }
}

/* ---------- RUTAS SOLO v1 ---------- */
const PATHS = {
  users: {
    list: (q) => `${V1}/users${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    guards: (q, active = true) =>
      `${V1}/users/guards${
        q || active
          ? `?${[
              q ? `q=${encodeURIComponent(q)}` : "",
              active ? "active=1" : "",
            ]
              .filter(Boolean)
              .join("&")}`
          : ""
      }`,
    create: () => `${V1}/users`,
    byId: (id) => `${V1}/users/${id}`,
    enable: (id) => `${V1}/users/${id}/enable`,
    disable: (id) => `${V1}/users/${id}/disable`,
    verify: (id) => `${V1}/users/${id}/verify-email`,
  },
  roles: {
    list: () => `${V1}/roles`,
    create: () => `${V1}/roles`,
    byId: (id) => `${V1}/roles/${id}`,
    permissions: (id) => `${V1}/roles/${id}/permissions`,
  },
  perms: {
    list: () => `${V1}/permissions`,
    create: () => `${V1}/permissions`,
    byId: (id) => `${V1}/permissions/${id}`,
    listByRole: (roleId) =>
      `${V1}/permissions?role=${encodeURIComponent(roleId)}`,
  },
  audit: {
    list: () => `${V1}/audit`,
  },
  auth: {
    me: () => `${V1}/me`,
    login: () => `${V1}/auth/login`,
  },
};

/* ---------- helpers ---------- */
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
    obj?.name ??
    obj?.nombre ??
    obj?.displayName ??
    obj?.fullName ??
    obj?.razonSocial ??
    obj?.contactName ??
    "";

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const first =
    obj?.firstName ??
    obj?.firstname ??
    obj?.nombres ??
    obj?.primerNombre ??
    obj?.persona?.nombres ??
    obj?.persona?.firstName;

  const last =
    obj?.lastName ??
    obj?.lastname ??
    obj?.apellidos ??
    obj?.segundoNombre ??
    obj?.persona?.apellidos ??
    obj?.persona?.lastName;

  const combo = `${first || ""} ${last || ""}`.trim();
  if (combo) return combo;

  if (obj?.persona?.nombre || obj?.persona?.name) {
    return (obj?.persona?.nombre || obj?.persona?.name || "").trim();
  }

  return "";
}

function fromFormData(fd) {
  const toObj = {};
  fd.forEach((v, k) => {
    toObj[k] = v;
  });
  return toObj;
}

/* ✅ helper para construir query limpio */
function buildQuery(params = {}) {
  const qs = new URLSearchParams();

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    if (typeof v === "object") return;
    qs.set(k, String(v));
  });

  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* ---------- API ---------- */
export const iamApi = {
  async me(token) {
    return rawFetch(PATHS.auth.me(), { token });
  },

  async loginLocal({ email, password }) {
    const body = {
      email: String(email || "").trim().toLowerCase(),
      password: String(password || ""),
    };
    return rawFetch(PATHS.auth.login(), { method: "POST", body });
  },

  /* ---------- ROLES ---------- */
  listRoles: (t) => rawFetch(PATHS.roles.list(), { token: t }),

  createRole: (p, t) => {
    const body = { ...(p || {}) };

    const rawName =
      body.name || body.role || body.label || body.displayName || "";
    if (!rawName)
      throw new Error("name es requerido para crear rol (faltan datos)");

    body.name = String(rawName).trim();

    if (!body.code || typeof body.code !== "string" || !body.code.trim()) {
      body.code = slugify(body.name);
    }
    if (!body.key || typeof body.key !== "string" || !body.key.trim()) {
      body.key = body.code;
    }

    if (Array.isArray(body.permissions)) {
      body.permissions = body.permissions
        .map((perm) => {
          if (!perm) return null;
          if (typeof perm === "string") return perm.trim();
          if (typeof perm === "object")
            return perm.key || perm.code || perm._id || null;
          return null;
        })
        .filter(Boolean);
    }

    if (!Array.isArray(body.permissionKeys) && Array.isArray(body.permissions)) {
      body.permissionKeys = body.permissions;
    }

    if (DEBUG) console.log("[iamApi.createRole] body:", body);

    return rawFetch(PATHS.roles.create(), { method: "POST", body, token: t });
  },

  updateRole: (id, p, t) =>
    rawFetch(PATHS.roles.byId(id), { method: "PATCH", body: p, token: t }),

  deleteRole: (id, t) =>
    rawFetch(PATHS.roles.byId(id), { method: "DELETE", token: t }),

  getRolePerms: (id, t) => rawFetch(PATHS.roles.permissions(id), { token: t }),

  setRolePerms: (id, keys, t) =>
    rawFetch(PATHS.roles.permissions(id), {
      method: "PUT",
      body: { permissionKeys: keys },
      token: t,
    }),

  /* ---------- PERMISOS ---------- */

  /**
   * ✅ FIX: soporta paginación y filtros para que NO se quede en 5.
   * Backend típico: /permissions?limit=...&page=...
   * También soporta: q (search), group, role (si tu API lo acepta)
   */
  listPerms: (arg = {}, t) => {
    // Compat: si lo llaman como listPerms(token)
    if (typeof arg === "string" || arg === null || arg === undefined) {
      return rawFetch(PATHS.perms.list(), { token: arg });
    }

    const params = arg && typeof arg === "object" ? { ...arg } : {};

    // Defaults razonables para UI catálogo
    const limit = Number.isFinite(Number(params.limit)) ? Number(params.limit) : 1000;
    const page = Number.isFinite(Number(params.page)) ? Number(params.page) : 1;

    const q = params.q || params.search || "";
    const group = params.group || "";
    const role = params.role || "";

    const query = buildQuery({ limit, page, q, group, role });

    return rawFetch(`${PATHS.perms.list()}${query}`, { token: t });
  },

  listPermsForRole: async (roleId, t) => {
    const [allPerms, rolePerms] = await Promise.all([
      // ✅ trae muchos, no 5
      iamApi.listPerms({ limit: 5000, page: 1 }, t),
      rawFetch(PATHS.roles.permissions(roleId), { token: t }),
    ]);

    const allItems = allPerms?.items || allPerms?.permissions || [];
    const keysFromRole =
      rolePerms?.permissionKeys || rolePerms?.keys || rolePerms?.items || [];

    const setKeys = new Set(Array.isArray(keysFromRole) ? keysFromRole : []);

    const items = allItems.map((p) => ({
      ...p,
      selected: setKeys.has(p.key) || setKeys.has(p._id),
    }));

    return { items };
  },

  createPerm: (p, t) =>
    rawFetch(PATHS.perms.create(), { method: "POST", body: p, token: t }),

  updatePerm: (id, p, t) =>
    rawFetch(PATHS.perms.byId(id), { method: "PATCH", body: p, token: t }),

  deletePerm: (id, t) =>
    rawFetch(PATHS.perms.byId(id), { method: "DELETE", token: t }),

  /* ---------- USUARIOS ---------- */
  listUsers: (q = "", t) => rawFetch(PATHS.users.list(q), { token: t }),

  listGuards: (q = "", active = true, t) =>
    rawFetch(PATHS.users.guards(q, active), { token: t }),

  createUser: (payload, t) => {
    let email = "";
    let name = "";
    let roles = [];
    let active = true;
    let perms;
    let password;

    if (typeof FormData !== "undefined" && payload instanceof FormData) {
      const obj = fromFormData(payload);
      email = findEmailAny(obj);
      name = findNameAny(obj);
      roles = obj.roles
        ? Array.isArray(obj.roles)
          ? obj.roles
          : String(obj.roles).split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      active =
        obj.active !== undefined
          ? obj.active === true || obj.active === "true"
          : true;
      if (obj.perms) {
        perms = Array.isArray(obj.perms)
          ? obj.perms
          : String(obj.perms)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      }
      password = obj.password ?? obj.clave ?? obj.contrasena ?? obj.contraseña ?? "";
    } else {
      const obj = payload || {};
      email =
        findEmailAny(obj) ||
        String(
          obj.email ??
            obj.correo ??
            obj.correoPersona ??
            obj.personalEmail ??
            obj.mail ??
            obj?.persona?.email ??
            obj?.persona?.correo ??
            ""
        );
      name = findNameAny(obj);
      roles = Array.isArray(obj.roles)
        ? obj.roles
        : typeof obj.roles === "string"
        ? obj.roles.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      active = obj.active === undefined ? true : !!obj.active;
      if (obj.perms) {
        perms = Array.isArray(obj.perms)
          ? obj.perms
          : String(obj.perms)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      }
      password = obj.password ?? obj.clave ?? obj.contrasena ?? obj.contraseña ?? "";
    }

    email = String(email || "").trim().toLowerCase();
    name = String(name || "").trim() || nameFromEmail(email);

    if (!email) return Promise.reject(new Error("email requerido"));

    const body = {
      name,
      email,
      roles,
      active,
      ...(perms ? { perms } : {}),
      ...(password ? { password: String(password) } : {}),
    };

    return rawFetch(PATHS.users.create(), { method: "POST", body, token: t });
  },

  updateUser: (id, p, t) =>
    rawFetch(PATHS.users.byId(id), { method: "PATCH", body: p, token: t }),

  enableUser: (id, t) =>
    rawFetch(PATHS.users.enable(id), { method: "POST", token: t }),

  disableUser: (id, t) =>
    rawFetch(PATHS.users.disable(id), { method: "POST", token: t }),

  // ✅ CORRECCIÓN: borrar usuario de verdad
  deleteUser: (id, t) =>
    rawFetch(PATHS.users.byId(id), { method: "DELETE", token: t }),

  /* ✅ AUDIT */
  async listAudit(arg = {}, token) {
    const params =
      typeof arg === "number"
        ? { limit: arg }
        : arg && typeof arg === "object"
        ? { ...arg }
        : {};

    const limit = Number.isFinite(Number(params.limit)) ? Number(params.limit) : 100;
    const skip = Number.isFinite(Number(params.skip)) ? Number(params.skip) : 0;

    const q = buildQuery({
      limit,
      skip,
      action: params.action || "",
      entity: params.entity || "",
      actor: params.actor || "",
      from: params.from || "",
      to: params.to || "",
    });

    try {
      return await rawFetch(`${PATHS.audit.list()}${q}`, { token });
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      if (e?.status === 404 || msg.includes("not found") || msg.includes("404")) {
        return { ok: false, items: [], total: 0, limit, skip };
      }
      throw e;
    }
  },

  importExcel(file, token) {
    const fd = new FormData();
    fd.append("file", file);
    return rawFetch(`${V1}/import/excel`, {
      method: "POST",
      body: fd,
      token,
      formData: true,
    });
  },

  async sendVerificationEmail(userId, email, token) {
    if (!userId || !email) throw new Error("Faltan datos para verificación");
    try {
      return await rawFetch(PATHS.users.verify(userId), {
        method: "POST",
        body: { email },
        token,
      });
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      const notImpl =
        e?.status === 404 ||
        e?.status === 501 ||
        msg.includes("not implemented") ||
        msg.includes("no implementado");

      if (notImpl) {
        if (DEBUG)
          console.warn("[iamApi] /verify-email no implementado; simulando…", {
            userId,
            email,
          });
        await new Promise((r) => setTimeout(r, 700));
        return {
          ok: true,
          simulated: true,
          message: "Simulación de verificación enviada",
        };
      }
      throw e;
    }
  },
};

export default iamApi;
