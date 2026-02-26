// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";
import jwt from "jsonwebtoken";

console.log("[iam] boot", {
  NODE_ENV: process.env.NODE_ENV,
  IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
  IAM_ALLOW_DEV_HEADERS: process.env.IAM_ALLOW_DEV_HEADERS,
  ROOT_ADMINS: process.env.ROOT_ADMINS,
  IAM_DEFAULT_VISITOR_ROLE: process.env.IAM_DEFAULT_VISITOR_ROLE,
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
   JWT local helpers (HS256)
   ========================= */
function getBearer(req) {
  const h = String(req?.headers?.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

function getJwtPayload(req) {
  const token = getBearer(req);
  if (!token) return { payload: null, source: "none" };

  try {
    const p = jwt.verify(token, process.env.JWT_SECRET || "dev_secret", {
      algorithms: ["HS256"],
    });
    return { payload: p, source: "local" };
  } catch {
    return { payload: null, source: "none" };
  }
}

function getEmailFromPayload(payload) {
  if (!payload) return null;
  if (payload.email) return String(payload.email).toLowerCase().trim();
  return null;
}

function getDefaultVisitorRole() {
  return String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita")
    .trim()
    .toLowerCase();
}

export async function buildContextFrom(req) {
  const { payload } = getJwtPayload(req);

  const IS_PROD = process.env.NODE_ENV === "production";
  const allowDevHeaders =
    !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

  const headerEmail = allowDevHeaders ? req?.headers?.["x-user-email"] : null;

  const jwtEmail = getEmailFromPayload(payload);
  let email = (jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  const headerRoles = allowDevHeaders ? parseList(req?.headers?.["x-roles"]) : [];
  const headerPerms = allowDevHeaders ? parseList(req?.headers?.["x-perms"]) : [];

  const hasIdentity = !!payload && !!email;

  let user = null;

  // Buscar por email
  if (email) {
    user = await withTimeout(
      IamUser.findOne({ email }).lean(),
      4000,
      "IamUser.findOne(email)"
    );
  }

  // ✅ Auto-provision (solo si hay identidad)
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
        console.log(`[iam] auto-provisioned: ${doc.email} (ADMIN)`);
      } catch (e) {
        const existing = email ? await IamUser.findOne({ email }).lean() : null;
        if (existing) user = existing;
        else console.warn("[iam] auto-provision failed:", e?.message || e);
      }
    }

    // 2) Auto-provision VISITA
    if (!user && email) {
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
        const created = await withTimeout(
          IamUser.create(doc),
          4000,
          "IamUser.create(visitor)"
        );
        user = created.toObject();
        console.log(`[iam] auto-provisioned: ${doc.email} (VISITA)`);
      } catch (e) {
        const existing = await IamUser.findOne({ email }).lean();
        if (existing) user = existing;
        else console.warn("[iam] visitor auto-provision failed:", e?.message || e);
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

  const superEmail = String(process.env.SUPERADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
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