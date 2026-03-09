// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";
import { getBearer, verifyToken } from "./jwt.util.js";

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

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s || ""));
  } catch {
    return null;
  }
}

function parseListSmart(v) {
  const j = safeJsonParse(v);
  if (Array.isArray(j)) return j.map((x) => String(x || "").trim()).filter(Boolean);
  return parseList(v);
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

function getJwtPayload(req) {
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
  return String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita")
    .trim()
    .toLowerCase();
}

function canUseDevHeaders() {
  return !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";
}

function normRole(r) {
  return String(r || "").trim().toLowerCase();
}

function normPerm(p) {
  return String(p || "").trim();
}

function getSuperadminEmails() {
  return [
    process.env.SUPERADMIN_EMAIL,
    process.env.VITE_SUPERADMIN_EMAIL,
    process.env.ROOT_ADMINS,
    "proyectosenaf@gmail.com",
  ]
    .flatMap((v) =>
      String(v || "")
        .split(",")
        .map((x) => x.trim().toLowerCase())
    )
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function isSuperadminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return getSuperadminEmails().includes(e);
}

function isAdminLikeRolesPerms({ roles = [], permissions = [], isSuperAdmin = false }) {
  if (isSuperAdmin) return true;

  const R = new Set((roles || []).map(normRole).filter(Boolean));
  const Praw = Array.isArray(permissions) ? permissions : [];
  const Plow = new Set(Praw.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));

  if (Plow.has("*")) return true;
  if (R.has("admin") || R.has("administrador") || R.has("ti") || R.has("administrador_it")) {
    return true;
  }

  return false;
}

export async function buildContextFrom(req) {
  const { payload } = getJwtPayload(req);

  const allowDevHeaders = canUseDevHeaders();

  const headerEmail = allowDevHeaders ? req?.headers?.["x-user-email"] : null;

  const headerRolesRaw = allowDevHeaders
    ? req?.headers?.["x-user-roles"] ?? req?.headers?.["x-roles"]
    : null;

  const headerPermsRaw = allowDevHeaders
    ? req?.headers?.["x-user-perms"] ?? req?.headers?.["x-perms"]
    : null;

  const headerRoles = allowDevHeaders ? parseListSmart(headerRolesRaw) : [];
  const headerPerms = allowDevHeaders ? parseListSmart(headerPermsRaw) : [];

  const jwtEmail = getEmailFromPayload(payload);

  const email = String(jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  const hasIdentity = !!email && (!!payload || !!headerEmail);

  let user = null;

  if (email) {
    try {
      user = await withTimeout(IamUser.findOne({ email }).lean(), 4000, "IamUser.findOne(email)");
    } catch (e) {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.warn("[iam] IamUser.findOne failed:", e?.message || e);
      }
      user = null;
    }
  }

  const forcedSuperadmin = isSuperadminEmail(email);

  if (!user && hasIdentity && email) {
    const isBootstrapAdmin = forcedSuperadmin;

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

  const defaultVisitorRole = getDefaultVisitorRole();

  const baseRoles = user
    ? Array.isArray(user.roles)
      ? user.roles
      : []
    : hasIdentity
    ? [defaultVisitorRole]
    : [];

  const roleNames = new Set(
    [...baseRoles.map(normRole), ...headerRoles.map(normRole)].filter(Boolean)
  );

  const permSet = new Set([...(user?.perms || []).map(normPerm)].filter(Boolean));

  if (allowDevHeaders) {
    headerPerms
      .map(normPerm)
      .filter(Boolean)
      .forEach((p) => permSet.add(p));
  }

  if (roleNames.size) {
    const codesLower = [...roleNames]
      .map((r) => String(r).trim().toLowerCase())
      .filter(Boolean);

    const namesRaw = [...new Set([...(user?.roles || []), ...headerRoles])]
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    const namesLower = namesRaw.map((x) => x.toLowerCase());

    try {
      const roleDocs = await withTimeout(
        IamRole.find({
          $or: [
            { code: { $in: codesLower } },
            { name: { $in: namesRaw } },
            { name: { $in: namesLower } },
            { key: { $in: codesLower } },
          ],
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

  const isSuperAdmin = forcedSuperadmin;

  const rolesFinal = [...roleNames];

  const adminLike = isAdminLikeRolesPerms({
    roles: rolesFinal,
    permissions: [...permSet],
    isSuperAdmin,
  });

  if (adminLike) {
    const permSetLowerTemp = new Set([...permSet].map((p) => String(p).toLowerCase()));
    if (!permSet.has("*") && !permSetLowerTemp.has("*")) {
      permSet.add("*");
    }
  }

  const permissionsFinal = [...permSet];
  const permSetLower = new Set(permissionsFinal.map((p) => String(p).toLowerCase()));

  function has(perm) {
    if (isSuperAdmin) return true;
    if (adminLike) return true;
    if (permSet.has("*") || permSetLower.has("*")) return true;
    if (!perm) return true;

    const raw = normPerm(perm);
    const low = raw.toLowerCase();

    return permSet.has(raw) || permSetLower.has(low);
  }

  const isVisitor = adminLike ? false : roleNames.has(defaultVisitorRole);

  return {
    user,
    email,
    roles: rolesFinal,
    permissions: permissionsFinal,
    has,
    isSuperAdmin,
    isVisitor,
  };
}

export function devOr(mw) {
  const allow = !IS_PROD && String(process.env.IAM_DEV_ALLOW_ALL || "0") === "1";
  return (req, res, next) => (allow ? next() : mw(req, res, next));
}

/**
 * ✅ requirePerm:
 * - acepta string: "iam.roles.manage"
 * - o array: ["iam.permissions.manage","iam.roles.manage"] (ANY-OF)
 */
export function requirePerm(perm) {
  const needList = Array.isArray(perm) ? perm : [perm];
  const need = needList.map((x) => String(x || "").trim()).filter(Boolean);

  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      if (!ctx?.email) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const ok = need.length ? need.some((p) => ctx.has(p)) : true;

      if (!ok) {
        return res.status(403).json({
          message: "forbidden",
          need: Array.isArray(perm) ? need : String(perm || ""),
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