// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

import jwt from "jsonwebtoken";
import axios from "axios";

console.log("[iam] boot", {
  NODE_ENV: process.env.NODE_ENV,
  IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
  IAM_ALLOW_DEV_HEADERS: process.env.IAM_ALLOW_DEV_HEADERS,
  ROOT_ADMINS: process.env.ROOT_ADMINS,
  IAM_EMAIL_CLAIM: process.env.IAM_EMAIL_CLAIM,
  IAM_CLAIMS_NAMESPACE: process.env.IAM_CLAIMS_NAMESPACE,
  IAM_DEFAULT_VISITOR_ROLE: process.env.IAM_DEFAULT_VISITOR_ROLE,
  AUTH0_MGMT_DOMAIN: process.env.AUTH0_MGMT_DOMAIN ? "[set]" : "[missing]",
});

export function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function withTimeout(promise, ms, label = "op") {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`[timeout] ${label} > ${ms}ms`)), ms)
    ),
  ]);
}

/* =========================
   Auth0 Management helpers
   ========================= */
function normalizeDomain(d) {
  return String(d || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .trim();
}

let _mgmtToken = null;
let _mgmtTokenExp = 0;

async function getMgmtToken() {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  const client_id = process.env.AUTH0_MGMT_CLIENT_ID;
  const client_secret = process.env.AUTH0_MGMT_CLIENT_SECRET;

  if (!domain || !client_id || !client_secret) return null;

  const now = Date.now();
  if (_mgmtToken && now < _mgmtTokenExp - 30_000) return _mgmtToken;

  const url = `https://${domain}/oauth/token`;

  const r = await withTimeout(
    axios.post(
      url,
      {
        grant_type: "client_credentials",
        client_id,
        client_secret,
        audience: `https://${domain}/api/v2/`,
      },
      { timeout: 6000 }
    ),
    7000,
    "auth0.mgmt.token"
  );

  const token = r?.data?.access_token || null;
  const expiresIn = Number(r?.data?.expires_in || 3600);
  if (!token) return null;

  _mgmtToken = token;
  _mgmtTokenExp = now + expiresIn * 1000;
  return token;
}

async function getEmailFromAuth0BySub(auth0Sub) {
  try {
    const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
    if (!domain) return null;

    const token = await getMgmtToken();
    if (!token) return null;

    const r = await withTimeout(
      axios.get(`https://${domain}/api/v2/users/${encodeURIComponent(auth0Sub)}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 6000,
      }),
      7000,
      "auth0.mgmt.getUser"
    );

    const email = r?.data?.email;
    return email ? String(email).toLowerCase().trim() : null;
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      String(e);
    console.warn("[iam] auth0 mgmt get email failed:", msg);
    return null;
  }
}

/**
 * Extrae payload:
 * 1) Auth0 (RS256) -> req.auth.payload (ya verificado)
 * 2) Local JWT (HS256) -> Authorization Bearer + JWT_SECRET
 */
function getJwtPayload(req) {
  if (req?.auth?.payload) {
    return { payload: req.auth.payload, source: "auth0" };
  }

  const authHeader = req?.headers?.authorization || "";
  const parts = String(authHeader).split(" ");
  const token = parts.length === 2 ? parts[1] : null;
  if (!token) return { payload: null, source: "none" };

  try {
    const p = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    return { payload: p, source: "local" };
  } catch {
    return { payload: null, source: "none" };
  }
}

function getAuth0Sub(payload) {
  const sub = payload?.sub;
  return sub ? String(sub).trim() : null;
}

/** Normaliza namespace base (sin slash final) */
function normalizeBaseNs(ns) {
  const s = String(ns || "").trim();
  if (!s) return "";
  return s.replace(/\/+$/g, "");
}

function claim(baseNs, key) {
  const b = normalizeBaseNs(baseNs);
  return b ? `${b}/${key}` : "";
}

function getEmailFromPayload(payload) {
  if (!payload) return null;

  // 1) email estándar
  if (payload.email) return String(payload.email).toLowerCase().trim();

  // 2) claim exacto configurable
  const exact = String(process.env.IAM_EMAIL_CLAIM || "").trim();
  if (exact && payload[exact]) return String(payload[exact]).toLowerCase().trim();

  // 3) namespace base: https://senaf => https://senaf/email
  const baseNs = normalizeBaseNs(process.env.IAM_CLAIMS_NAMESPACE || "https://senaf");
  const nsEmail = payload[claim(baseNs, "email")];
  if (nsEmail) return String(nsEmail).toLowerCase().trim();

  // 4) fallback compat
  if (payload["https://senaf/email"]) return String(payload["https://senaf/email"]).toLowerCase().trim();
  if (payload["https://senaf.local/email"]) return String(payload["https://senaf.local/email"]).toLowerCase().trim();

  return null;
}

function getDefaultVisitorRole() {
  return String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita")
    .trim()
    .toLowerCase();
}

function parseRolesFromPayload(payload) {
  if (!payload) return [];
  const baseNs = normalizeBaseNs(process.env.IAM_CLAIMS_NAMESPACE || "https://senaf");

  const rolesRaw =
    payload[claim(baseNs, "roles")] ||
    payload["https://senaf/roles"] ||
    payload["https://senaf.local/roles"] ||
    payload.roles ||
    [];

  const arr = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
  return Array.from(
    new Set(
      arr
        .map((r) => String(r || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function parsePermsFromPayload(payload) {
  if (!payload) return [];
  const baseNs = normalizeBaseNs(process.env.IAM_CLAIMS_NAMESPACE || "https://senaf");

  // 1) Namespaced permissions (tu Action)
  const nsPerms = payload[claim(baseNs, "permissions")] || payload["https://senaf/permissions"];
  let perms = Array.isArray(nsPerms) ? nsPerms : [];

  // 2) Auth0 RBAC permissions (string[])
  if ((!perms || perms.length === 0) && Array.isArray(payload.permissions)) {
    perms = payload.permissions;
  }

  // 3) scope
  if ((!perms || perms.length === 0) && typeof payload.scope === "string") {
    perms = payload.scope
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 4) fallback
  if ((!perms || perms.length === 0) && Array.isArray(payload.perms)) {
    perms = payload.perms;
  }

  return Array.from(
    new Set(
      (perms || [])
        .map((p) => String(p || "").trim())
        .filter(Boolean)
    )
  );
}

export async function buildContextFrom(req) {
  const { payload, source } = getJwtPayload(req);

  const auth0Sub = getAuth0Sub(payload);
  const jwtEmail = getEmailFromPayload(payload);

  const IS_PROD = process.env.NODE_ENV === "production";
  const allowDevHeaders =
    !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

  const headerEmail = allowDevHeaders ? req?.headers?.["x-user-email"] : null;

  let email = (jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  // Si viene sub Auth0 pero no email, resolverlo vía Management API
  if (!email && auth0Sub && source === "auth0") {
    email = await getEmailFromAuth0BySub(auth0Sub);
  }

  const headerRoles = allowDevHeaders ? parseList(req?.headers?.["x-roles"]) : [];
  const headerPerms = allowDevHeaders ? parseList(req?.headers?.["x-perms"]) : [];

  // Roles/perms desde token (Auth0 Action) si vienen:
  const tokenRoles = source === "auth0" ? parseRolesFromPayload(payload) : [];
  const tokenPerms = source === "auth0" ? parsePermsFromPayload(payload) : [];

  let user = null;

  // Buscar por auth0Sub primero
  if (auth0Sub) {
    user = await withTimeout(
      IamUser.findOne({ auth0Sub }).lean(),
      4000,
      "IamUser.findOne(auth0Sub)"
    );
  }

  // Buscar por email
  if (!user && email) {
    user = await withTimeout(
      IamUser.findOne({ email }).lean(),
      4000,
      "IamUser.findOne(email)"
    );
  }

  const hasIdentity = !!payload && (!!email || !!auth0Sub);

  // ✅ Política:
  // - Sí auto-crear VISITA en IAM para llevar control
  // - Auto-crear bootstrap admin (superadmin/root) si no existe
  if (!user && hasIdentity) {
    const rootAdmins = parseList(process.env.ROOT_ADMINS || "").map((x) =>
      String(x).toLowerCase().trim()
    );

    const superEmail = String(process.env.SUPERADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    const isBootstrapAdmin =
      (!!email && !!superEmail && email === superEmail) ||
      (!!email && rootAdmins.includes(email));

    // 1) Bootstrap admin
    if (isBootstrapAdmin && email) {
      const doc = {
        email: email || undefined,
        name: email ? email.split("@")[0] : undefined,
        auth0Sub: auth0Sub || undefined,
        active: true,
        provider: source === "local" ? "local" : "auth0",
        roles: ["admin"],
        perms: ["*"],

        // ✅ explícito: bootstrap admin NO usa prelogin
        mustChangePassword: false,
        tempPassHash: "",
        tempPassExpiresAt: null,
        tempPassUsedAt: null,
        tempPassAttempts: 0,
      };

      try {
        const created = await withTimeout(
          IamUser.create(doc),
          4000,
          "IamUser.create(bootstrap-admin)"
        );
        user = created.toObject();
        console.log(`[iam] auto-provisioned: ${doc.email} (ADMIN)`);
      } catch (e) {
        // si chocó por unique, intenta leer
        const existing = email ? await IamUser.findOne({ email }).lean() : null;
        if (existing) user = existing;
        else console.warn("[iam] auto-provision failed:", e?.message || e);
      }
    }

    // 2) Auto-provision VISITA (si no era bootstrap admin o si no se creó arriba)
    if (!user && email) {
      const doc = {
        email,
        name: email.split("@")[0],
        auth0Sub: auth0Sub || undefined,
        active: true,
        provider: source === "local" ? "local" : "auth0",
        roles: [getDefaultVisitorRole()],
        perms: [],

        // ✅ visitas NO pasan por prelogin
        mustChangePassword: false,
        tempPassHash: "",
        tempPassExpiresAt: null,
        tempPassUsedAt: null,
        tempPassAttempts: 0,
      };

      try {
        const created = await withTimeout(
          IamUser.create(doc),
          4000,
          "IamUser.create(visitor)"
        );
        user = created.toObject();
        console.log(`[iam] auto-provisioned: ${doc.email} (VISITA)`);
      } catch (e) {
        // si chocó por unique (paralelo), intenta leerlo
        const existing = await IamUser.findOne({ email }).lean();
        if (existing) user = existing;
        else console.warn("[iam] visitor auto-provision failed:", e?.message || e);
      }
    }
  }

  // Si existe user y falta auth0Sub, adjuntarlo
  if (user && auth0Sub && !user.auth0Sub) {
    try {
      await withTimeout(
        IamUser.updateOne({ _id: user._id }, { $set: { auth0Sub } }),
        4000,
        "IamUser.updateOne(attach-auth0Sub)"
      );
      user.auth0Sub = auth0Sub;
    } catch (e) {
      console.warn("[iam] could not attach auth0Sub:", e?.message || e);
    }
  }

  const normRole = (r) => String(r || "").trim().toLowerCase();
  const normPerm = (p) => String(p || "").trim();

  // Fuente de roles:
  // - Si existe usuario en IAM => su roles
  // - Si NO existe (caso raro) => tokenRoles o defaultVisitorRole
  // - + headers dev (si aplica)
  const defaultVisitorRole = getDefaultVisitorRole();

  const baseRoles =
    user && Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : tokenRoles && tokenRoles.length
      ? tokenRoles
      : hasIdentity
      ? [defaultVisitorRole]
      : [];

  const roleNames = new Set(
    [...baseRoles.map(normRole), ...headerRoles.map(normRole)].filter(Boolean)
  );

  // Fuente de permisos:
  // - IAM user perms (si existe)
  // - tokenPerms (si vienen)
  // - headers dev (si aplica)
  const permSet = new Set(
    [
      ...((user?.perms || []).map(normPerm)),
      ...(tokenPerms || []).map(normPerm),
    ].filter(Boolean)
  );

  if (allowDevHeaders) headerPerms.map(normPerm).filter(Boolean).forEach((p) => permSet.add(p));

  // Expand perms por roles desde IamRole
  if (roleNames.size) {
    const roleList = [...roleNames].map((r) => String(r).trim());
    const roleDocs = await withTimeout(
      IamRole.find({
        $or: [{ code: { $in: roleList } }, { name: { $in: roleList } }],
      }).lean(),
      4000,
      "IamRole.find(expand-perms)"
    );

    for (const r of roleDocs) {
      (r.permissions || []).forEach((p) => {
        const pp = normPerm(p);
        if (pp) permSet.add(pp);
      });
    }
  }

  const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const isSuperAdmin = !!email && !!superEmail && email === superEmail;

  function has(perm) {
    if (isSuperAdmin) return true;
    if (permSet.has("*")) return true;
    if (!perm) return true;
    return permSet.has(String(perm).trim());
  }

  const isVisitor = roleNames.has(defaultVisitorRole);

  return {
    user,
    email,
    auth0Sub,
    roles: [...roleNames],
    permissions: [...permSet],
    has,
    isSuperAdmin,
    isVisitor,
  };
}

export function devOr(mw) {
  const isProd = process.env.NODE_ENV === "production";
  const allow = process.env.IAM_DEV_ALLOW_ALL === "1" || !isProd;
  return (req, res, next) => (allow ? next() : mw(req, res, next));
}

export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      // Si no hay identidad, no autenticado
      if (!ctx?.email && !ctx?.auth0Sub) {
        return res.status(401).json({ message: "No autenticado" });
      }

      if (!ctx.has(perm)) {
        return res.status(403).json({
          message: "forbidden",
          need: perm,
          email: ctx.email,
          auth0Sub: ctx.auth0Sub,
          roles: ctx.roles,
          perms: ctx.permissions,
          visitor: ctx.isVisitor,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}