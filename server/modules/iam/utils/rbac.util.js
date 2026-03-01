// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";
import { getBearer, verifyToken } from "./jwt.util.js";

/**
 * Seguridad: no expongas env vars en producción.
 * Si quieres debug, usa IAM_DEBUG=1 en dev.
 */
const IAM_DEBUG = String(process.env.IAM_DEBUG || "0") === "1";
const IS_PROD = process.env.NODE_ENV === "production";

if (!IS_PROD && IAM_DEBUG) {
  // eslint-disable-next-line no-console
  console.log("[iam] boot", {
    NODE_ENV: process.env.NODE_ENV,
    IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
    SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
    IAM_ALLOW_DEV_HEADERS: process.env.IAM_ALLOW_DEV_HEADERS,
    ROOT_ADMINS: process.env.ROOT_ADMINS,
    IAM_DEFAULT_VISITOR_ROLE: process.env.IAM_DEFAULT_VISITOR_ROLE,
  });
}

export function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function withTimeout(promise, ms, label = "op") {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`[timeout] ${label} > ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

/* =========================
   JWT local helpers (HS256)
   - Reutiliza req.auth.payload si el middleware ya verificó
   ========================= */
function getJwtPayload(req) {
  // ✅ si ya pasó makeAuthMw, no vuelvas a verificar
  const pre = req?.auth?.payload;
  if (pre && typeof pre === "object") return { payload: pre, source: "req.auth" };

  const token = getBearer(req);
  if (!token) return { payload: null, source: "none" };

  try {
    const p = verifyToken(token);
    return { payload: p, source: "local" };
  } catch (e) {
    if (!IS_PROD && IAM_DEBUG) {
      // eslint-disable-next-line no-console
      console.warn("[iam] jwt verify failed:", e?.message || e);
    }
    return { payload: null, source: "none" };
  }
}

function getEmailFromPayload(payload) {
  if (!payload) return null;
  if (payload.email) return String(payload.email).toLowerCase().trim();
  if (payload.correo) return String(payload.correo).toLowerCase().trim();
  return null;
}

function getDefaultVisitorRole() {
  return String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita").trim().toLowerCase();
}

/**
 * Centralización:
 * - En PROD NO aceptamos headers de suplantación.
 * - En DEV solo si IAM_ALLOW_DEV_HEADERS=1
 */
function canUseDevHeaders() {
  return !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";
}

export async function buildContextFrom(req) {
  const { payload } = getJwtPayload(req);

  const allowDevHeaders = canUseDevHeaders();

  const headerEmail = allowDevHeaders ? req?.headers?.["x-user-email"] : null;
  const headerRoles = allowDevHeaders ? parseList(req?.headers?.["x-roles"]) : [];
  const headerPerms = allowDevHeaders ? parseList(req?.headers?.["x-perms"]) : [];

  const jwtEmail = getEmailFromPayload(payload);

  // Identidad: preferimos JWT; si no hay, y allowDevHeaders, usamos header.
  const email = String(jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  const hasIdentity = !!email && (!!payload || !!headerEmail);

  let user = null;

  // Buscar por email (si hay)
  if (email) {
    try {
      user = await withTimeout(
        IamUser.findOne({ email }).lean(),
        4000,
        "IamUser.findOne(email)"
      );
    } catch (e) {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.warn("[iam] IamUser.findOne failed:", e?.message || e);
      }
      user = null;
    }
  }

  /* =========================
     ✅ Auto-provision (solo si hay identidad real)
     - Bootstrap admin por SUPERADMIN_EMAIL o ROOT_ADMINS
     - Si no existe, crea VISITA por defecto
  ========================= */
  if (!user && hasIdentity && email) {
    const rootAdmins = parseList(process.env.ROOT_ADMINS || "").map((x) =>
      String(x).toLowerCase().trim()
    );

    const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();

    const isBootstrapAdmin = (!!superEmail && email === superEmail) || rootAdmins.includes(email);

    // 1) Bootstrap admin
    if (isBootstrapAdmin) {
      const doc = {
        email,
        name: email.split("@")[0],
        active: true,
        provider: "local",
        roles: ["admin"],
        perms: ["*"],

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
        if (!IS_PROD) {
          // eslint-disable-next-line no-console
          console.log(`[iam] auto-provisioned: ${doc.email} (ADMIN)`);
        }
      } catch (e) {
        // carrera: si ya existe, lo leemos
        try {
          const existing = await withTimeout(
            IamUser.findOne({ email }).lean(),
            4000,
            "IamUser.findOne(retry-after-create-fail)"
          );
          if (existing) user = existing;
          else if (!IS_PROD) console.warn("[iam] auto-provision failed:", e?.message || e);
        } catch {
          if (!IS_PROD) console.warn("[iam] auto-provision failed:", e?.message || e);
        }
      }
    }

    // 2) Auto-provision VISITA
    if (!user) {
      const doc = {
        email,
        name: email.split("@")[0],
        active: true,
        provider: "local",
        roles: [getDefaultVisitorRole()],
        perms: [],

        mustChangePassword: false,
        tempPassHash: "",
        tempPassExpiresAt: null,
        tempPassUsedAt: null,
        tempPassAttempts: 0,
      };

      try {
        const created = await withTimeout(IamUser.create(doc), 4000, "IamUser.create(visitor)");
        user = created.toObject();
        if (!IS_PROD && IAM_DEBUG) {
          // eslint-disable-next-line no-console
          console.log(`[iam] auto-provisioned: ${doc.email} (VISITA)`);
        }
      } catch (e) {
        try {
          const existing = await withTimeout(
            IamUser.findOne({ email }).lean(),
            4000,
            "IamUser.findOne(retry-visitor)"
          );
          if (existing) user = existing;
          else if (!IS_PROD) console.warn("[iam] visitor auto-provision failed:", e?.message || e);
        } catch {
          if (!IS_PROD) console.warn("[iam] visitor auto-provision failed:", e?.message || e);
        }
      }
    }
  }

  const normRole = (r) => String(r || "").trim().toLowerCase();
  const normPerm = (p) => String(p || "").trim();

  const defaultVisitorRole = getDefaultVisitorRole();

  // Roles base: user.roles o visitor por defecto si hay identidad
  const baseRoles =
    user && Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : hasIdentity
      ? [defaultVisitorRole]
      : [];

  const roleNames = new Set(
    [...baseRoles.map(normRole), ...headerRoles.map(normRole)].filter(Boolean)
  );

  // Perms base: user.perms + headers dev
  const permSet = new Set([...(user?.perms || []).map(normPerm)].filter(Boolean));
  if (allowDevHeaders) {
    headerPerms
      .map(normPerm)
      .filter(Boolean)
      .forEach((p) => permSet.add(p));
  }

  // Expand perms por roles desde IamRole
  if (roleNames.size) {
    const roleList = [...roleNames].map((r) => String(r).trim().toLowerCase());

    try {
      // Nota: tolera roles guardados como code (lower) o name (varía).
      const roleDocs = await withTimeout(
        IamRole.find({
          $or: [{ code: { $in: roleList } }, { name: { $in: roleList } }, { key: { $in: roleList } }],
        }).lean(),
        4000,
        "IamRole.find(expand-perms)"
      );

      for (const r of roleDocs) {
        const permsArr = Array.isArray(r.permissions)
          ? r.permissions
          : Array.isArray(r.perms)
          ? r.perms
          : [];

        permsArr.forEach((p) => {
          const pp = normPerm(p);
          if (pp) permSet.add(pp);
        });
      }
    } catch (e) {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.warn("[iam] expand perms failed:", e?.message || e);
      }
    }
  }

  const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const isSuperAdmin = !!email && !!superEmail && email === superEmail;

  function has(perm) {
    if (isSuperAdmin) return true;
    if (permSet.has("*")) return true;
    if (!perm) return true;
    return permSet.has(normPerm(perm));
  }

  const isVisitor = roleNames.has(defaultVisitorRole);

  return {
    user,
    email,
    roles: [...roleNames],
    permissions: [...permSet],
    has,
    isSuperAdmin,
    isVisitor,
  };
}

/**
 * devOr: NO abrir todo por defecto en dev.
 * Solo bypass si IAM_DEV_ALLOW_ALL=1 y NO es prod.
 */
export function devOr(mw) {
  const allow = !IS_PROD && String(process.env.IAM_DEV_ALLOW_ALL || "0") === "1";
  return (req, res, next) => (allow ? next() : mw(req, res, next));
}

export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      if (!ctx?.email) {
        return res.status(401).json({ message: "No autenticado" });
      }

      if (!ctx.has(perm)) {
        return res.status(403).json({
          message: "forbidden",
          need: perm,
          email: ctx.email,
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