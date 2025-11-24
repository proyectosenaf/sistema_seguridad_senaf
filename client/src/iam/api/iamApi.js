// client/src/iam/api/iamApi.js
import { API } from "../../lib/api.js";

// Normaliza raíz de API para evitar dobles slashes
const API_ROOT = String(API || "").replace(/\/$/, "");
const V1 = `${API_ROOT}/iam/v1`;

const DEBUG = import.meta.env.VITE_IAM_DEBUG === "1";
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";
const FORCE_DEV = import.meta.env.VITE_FORCE_DEV_IAM === "1";

/* ─────────── NUEVO: provider de token tipo attachAuth0 ─────────── */

let tokenProvider = null;

/**
 * Llamado desde App.jsx para decirle a este módulo cómo conseguir el token
 * Ej:
 * attachIamAuth(async () => {
 *   const t = await getAccessTokenSilently(...);
 *   return t;
 * });
 */
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

  // ✅ Mandamos el token real (Auth0 / JWT)
  if (token) h.Authorization = `Bearer ${token}`;

  // Enviar headers DEV si:
  // - Fuerzas modo dev (VITE_FORCE_DEV_IAM=1), o
  // - No hay token y además la auth real está deshabilitada (VITE_DISABLE_AUTH=1)
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

  // 🔹 Si no nos pasaron token, intentamos usar el provider global attachIamAuth
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

    // OK
    if (contentType.includes("application/json")) return toJson(r);
    const text = await r.text().catch(() => "");
    return text || {};
  } catch (e) {
    // Error típico de red / CORS en fetch
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
    // Esta ruta vieja ya no se usa, pero la dejamos por compatibilidad
    listByRole: (roleId) =>
      `${V1}/permissions?role=${encodeURIComponent(roleId)}`,
  },
  auth: {
    me: () => `${V1}/me`,
    login: () => `${V1}/auth/login`,
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

/* ---------- API ---------- */
export const iamApi = {
  async me(token) {
    // usa rawFetch para que también aplique el provider global de token
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

  // Normaliza para que siempre haya name, code, key y permissions como KEYS (string[])
  createRole: (p, t) => {
    const body = { ...(p || {}) };

    // Aceptar distintos nombres de campo desde el formulario
    const rawName =
      body.name ||
      body.role ||
      body.label ||
      body.displayName ||
      "";

    if (!rawName) {
      throw new Error("name es requerido para crear rol (faltan datos)");
    }

    body.name = String(rawName).trim();

    // 🔥 Asegurar GENERACIÓN DE code aunque venga null/undefined/vacío
    if (
      !body.code ||
      typeof body.code !== "string" ||
      !body.code.trim()
    ) {
      body.code = slugify(body.name);
    }

    // 🔥 key = code (compatibilidad con backend simple que usa 'key')
    if (
      !body.key ||
      typeof body.key !== "string" ||
      !body.key.trim()
    ) {
      body.key = body.code;
    }

    // Normalizar permissions:
    // - puede venir como array de strings
    // - o array de objetos { key, _id, code }
    if (Array.isArray(body.permissions)) {
      body.permissions = body.permissions
        .map((perm) => {
          if (!perm) return null;
          if (typeof perm === "string") return perm.trim();
          if (typeof perm === "object") {
            return perm.key || perm.code || perm._id || null;
          }
          return null;
        })
        .filter(Boolean);
    }

    // Si no hay permissionKeys pero sí permissions, duplicamos
    if (
      !Array.isArray(body.permissionKeys) &&
      Array.isArray(body.permissions)
    ) {
      body.permissionKeys = body.permissions;
    }

    if (DEBUG) {
      console.log("[iamApi.createRole] body que se envía:", body);
    }

    return rawFetch(PATHS.roles.create(), {
      method: "POST",
      body,
      token: t,
    });
  },

  updateRole: (id, p, t) =>
    rawFetch(PATHS.roles.byId(id), {
      method: "PATCH",
      body: p,
      token: t,
    }),

  deleteRole: (id, t) =>
    rawFetch(PATHS.roles.byId(id), { method: "DELETE", token: t }),

  getRolePerms: (id, t) =>
    rawFetch(PATHS.roles.permissions(id), { token: t }),

  setRolePerms: (id, keys, t) =>
    rawFetch(PATHS.roles.permissions(id), {
      method: "PUT",
      body: { permissionKeys: keys },
      token: t,
    }),

  /* ---------- PERMISOS ---------- */
  listPerms: (t) => rawFetch(PATHS.perms.list(), { token: t }),

  /**
   * Nueva implementación:
   * - lee TODO el catálogo de permisos
   * - lee las permissionKeys del rol
   * - devuelve { items: [{...perm, selected:true|false}, ...] }
   */
  listPermsForRole: async (roleId, t) => {
    const [allPerms, rolePerms] = await Promise.all([
      rawFetch(PATHS.perms.list(), { token: t }),
      rawFetch(PATHS.roles.permissions(roleId), { token: t }),
    ]);

    const allItems =
      allPerms?.items || allPerms?.permissions || [];

    const keysFromRole =
      rolePerms?.permissionKeys ||
      rolePerms?.keys ||
      rolePerms?.items ||
      [];

    const setKeys = new Set(
      Array.isArray(keysFromRole) ? keysFromRole : []
    );

    const items = allItems.map((p) => ({
      ...p,
      selected: setKeys.has(p.key) || setKeys.has(p._id),
    }));

    return { items };
  },

  createPerm: (p, t) =>
    rawFetch(PATHS.perms.create(), { method: "POST", body: p, token: t }),

  updatePerm: (id, p, t) =>
    rawFetch(PATHS.perms.byId(id), {
      method: "PATCH",
      body: p,
      token: t,
    }),

  deletePerm: (id, t) =>
    rawFetch(PATHS.perms.byId(id), { method: "DELETE", token: t }),

  /* ---------- USUARIOS ---------- */
  listUsers: (q = "", t) => rawFetch(PATHS.users.list(q), { token: t }),

  // lista de guardias (para selects de otros módulos)
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
          : String(obj.roles)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
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
      password =
        obj.password ??
        obj.clave ??
        obj.contrasena ??
        obj.contraseña ??
        "";
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
        ? obj.roles
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
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
      password =
        obj.password ??
        obj.clave ??
        obj.contrasena ??
        obj.contraseña ??
        "";
    }

    email = String(email || "").trim().toLowerCase();
    name = String(name || "").trim() || nameFromEmail(email);

    if (!email) {
      if (DEBUG) {
        console.warn(
          "[iamApi.createUser] payload sin email. Keys:",
          payload instanceof FormData
            ? Array.from(payload.keys())
            : Object.keys(payload || {})
        );
      }
      return Promise.reject(new Error("email requerido"));
    }

    const body = {
      name,
      email,
      roles,
      active,
      ...(perms ? { perms } : {}),
      ...(password ? { password: String(password) } : {}),
    };

    return rawFetch(PATHS.users.create(), {
      method: "POST",
      body,
      token: t,
    });
  },

  updateUser: (id, p, t) =>
    rawFetch(PATHS.users.byId(id), {
      method: "PATCH",
      body: p,
      token: t,
    }),

  enableUser: (id, t) =>
    rawFetch(PATHS.users.enable(id), { method: "POST", token: t }),

  disableUser: (id, t) =>
    rawFetch(PATHS.users.disable(id), { method: "POST", token: t }),

  // "Eliminar" hace soft-delete / desactivar
  deleteUser: (id, t) =>
    rawFetch(PATHS.users.disable(id), { method: "POST", token: t }),

  async listAudit(limit = 100, token) {
    try {
      return await rawFetch(`${V1}/audit?limit=${encodeURIComponent(limit)}`, {
        token,
      });
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      if (
        e?.status === 404 ||
        msg.includes("not found") ||
        msg.includes("404")
      ) {
        return { ok: false, items: [] };
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
          console.warn(
            "[iamApi] /verify-email no implementado; simulando envío…",
            { userId, email }
          );
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
