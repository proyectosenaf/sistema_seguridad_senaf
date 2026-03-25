import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";
import IamSession from "../models/IamSession.model.js";
import { getBearer, verifyToken } from "./jwt.util.js";

const IAM_DEBUG = String(process.env.IAM_DEBUG || "0") === "1";
const IS_PROD = process.env.NODE_ENV === "production";

/* =========================
   Helpers base
========================= */
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
  if (Array.isArray(j)) {
    return j.map((x) => String(x || "").trim()).filter(Boolean);
  }
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

function normRole(r) {
  return String(r || "").trim().toLowerCase();
}

function normPerm(p) {
  return String(p || "").trim().toLowerCase();
}

function normalizeRoleValue(r) {
  if (typeof r === "string") return normRole(r);
  if (r && typeof r === "object") {
    return normRole(r.code || r.key || r.slug || r.name || r.nombre);
  }
  return "";
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeSubToUserId(sub) {
  const raw = String(sub || "").trim();
  if (!raw) return "";
  return raw.startsWith("local|") ? raw.slice(6) : raw;
}

/* =========================
   JWT + SESSION
========================= */
async function validateActiveSessionFromPayload(payload) {
  const sessionId = String(payload?.sid || "").trim();
  const userId = normalizeSubToUserId(payload?.sub);

  if (!sessionId || !userId) {
    return {
      ok: false,
      error: "invalid_session",
      details: "Token sin sid o sub válido",
    };
  }

  const session = await withTimeout(
    IamSession.findOne({
      userId,
      sessionId,
      isActive: true,
    }).lean(),
    4000,
    "IamSession.findOne(active-session)"
  );

  if (!session) {
    return {
      ok: false,
      error: "session_invalidated",
      details: "La sesión ya no está activa",
    };
  }

  await IamSession.updateOne(
    { _id: session._id },
    { $set: { lastActivityAt: new Date() } }
  ).catch(() => {});

  return { ok: true, session };
}

async function getJwtPayload(req) {
  const pre = req?.auth?.payload;
  if (pre && typeof pre === "object") {
    const sessionCheck = await validateActiveSessionFromPayload(pre).catch(
      () => null
    );

    if (!sessionCheck?.ok) {
      return { payload: null, session: null };
    }

    req.auth = req.auth || {};
    req.auth.session = sessionCheck.session;
    req.session = sessionCheck.session;
    req.sessionId = sessionCheck.session?.sessionId || pre?.sid || "";

    return { payload: pre, session: sessionCheck.session };
  }

  const token = getBearer(req);
  if (!token) return { payload: null, session: null };

  try {
    const payload = verifyToken(token);

    const sessionCheck = await validateActiveSessionFromPayload(payload);
    if (!sessionCheck.ok) {
      if (!IS_PROD && IAM_DEBUG) {
        console.warn("[iam] inactive session:", sessionCheck.error);
      }
      return { payload: null, session: null };
    }

    req.auth = req.auth || {};
    req.auth.payload = payload;
    req.auth.session = sessionCheck.session;
    req.session = sessionCheck.session;
    req.sessionId = sessionCheck.session?.sessionId || payload?.sid || "";

    return { payload, session: sessionCheck.session };
  } catch (e) {
    if (!IS_PROD && IAM_DEBUG) {
      console.warn("[iam] jwt verify failed:", e?.message || e);
    }
    return { payload: null, session: null };
  }
}

function getEmailFromPayload(payload) {
  if (!payload) return null;
  if (payload.email) return normalizeEmail(payload.email);
  if (payload.correo) return normalizeEmail(payload.correo);
  return null;
}

function getNameFromPayload(payload) {
  if (!payload) return "";
  return String(
    payload.name ||
      payload.nombreCompleto ||
      payload.fullName ||
      payload.nickname ||
      ""
  ).trim();
}

function getSubjectFromPayload(payload) {
  if (!payload) return "";
  return String(payload.sub || payload.id || payload.userId || "").trim();
}

/* =========================
   Config helpers
========================= */
function getDefaultVisitorRole() {
  return String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita")
    .trim()
    .toLowerCase();
}

function canUseDevHeaders() {
  return !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";
}

/* =========================
   Superadmin / protegidos
========================= */
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
        .map((x) => normalizeEmail(x))
    )
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function isSuperadminEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  return getSuperadminEmails().includes(e);
}

function getForcedSuperadminProfile(email, fallbackName = "") {
  const cleanEmail = normalizeEmail(email);
  const cleanName =
    String(fallbackName || "").trim() || cleanEmail.split("@")[0] || "Superadmin";

  return {
    email: cleanEmail,
    name: cleanName,
    active: true,
    provider: "local",
    roles: ["superadmin", "admin"],
    perms: ["*"],
    mustChangePassword: false,
    tempPassHash: "",
    tempPassExpiresAt: null,
    tempPassUsedAt: null,
    tempPassAttempts: 0,
  };
}

async function repairProtectedSuperadminUser(user, email, payloadName = "") {
  const forced = getForcedSuperadminProfile(email, payloadName);

  const currentRoles = Array.isArray(user?.roles) ? user.roles.map(normRole) : [];
  const hasNeededRoles =
    currentRoles.includes("superadmin") && currentRoles.includes("admin");

  const currentPerms = Array.isArray(user?.perms) ? user.perms.map(normPerm) : [];
  const hasWildcard = currentPerms.includes("*");

  const providerOk = String(user?.provider || "").trim().toLowerCase() === "local";
  const activeOk = user?.active !== false;

  const needsRepair =
    !hasNeededRoles ||
    !hasWildcard ||
    !providerOk ||
    !activeOk ||
    normalizeEmail(user?.email) !== forced.email;

  if (!needsRepair) return user;

  try {
    await withTimeout(
      IamUser.updateOne(
        { _id: user._id },
        {
          $set: {
            email: forced.email,
            name: forced.name,
            active: true,
            provider: "local",
            roles: forced.roles,
            perms: forced.perms,
            mustChangePassword: false,
          },
        }
      ),
      4000,
      "IamUser.updateOne(repair-superadmin)"
    );

    const repaired = await withTimeout(
      IamUser.findById(user._id).lean(),
      4000,
      "IamUser.findById(reload-superadmin)"
    );

    return repaired || {
      ...user,
      email: forced.email,
      name: forced.name,
      active: true,
      provider: "local",
      roles: forced.roles,
      perms: forced.perms,
      mustChangePassword: false,
    };
  } catch (e) {
    if (!IS_PROD && IAM_DEBUG) {
      console.warn("[iam] superadmin repair failed:", e?.message || e);
    }
    return {
      ...user,
      email: forced.email,
      name: forced.name,
      active: true,
      provider: "local",
      roles: forced.roles,
      perms: forced.perms,
      mustChangePassword: false,
    };
  }
}

/* =========================
   Context builder (CORE)
========================= */
export async function buildContextFrom(req) {
  const { payload } = await getJwtPayload(req);

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
  const payloadName = getNameFromPayload(payload);
  const payloadSub = getSubjectFromPayload(payload);

  const email = normalizeEmail(jwtEmail || headerEmail || "") || null;
  const hasIdentity = !!email;

  let user = null;

  if (email) {
    try {
      user = await withTimeout(
        IamUser.findOne({ email }).lean(),
        4000,
        "IamUser.findOne(email)"
      );
    } catch (e) {
      if (!IS_PROD && IAM_DEBUG) {
        console.warn("[iam] IamUser.findOne failed:", e?.message || e);
      }
      user = null;
    }
  }

  const forcedSuperadmin = isSuperadminEmail(email);

  if (!user && hasIdentity && email) {
    const doc = forcedSuperadmin
      ? getForcedSuperadminProfile(email, payloadName)
      : {
          email,
          name: payloadName || email.split("@")[0],
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
        forcedSuperadmin
          ? "IamUser.create(bootstrap-superadmin)"
          : "IamUser.create(visitor)"
      );
      user = created.toObject();
    } catch (e) {
      try {
        user = await withTimeout(
          IamUser.findOne({ email }).lean(),
          4000,
          "IamUser.findOne(retry-after-create)"
        );
      } catch {
        user = null;
      }

      if (!user && !IS_PROD && IAM_DEBUG) {
        console.warn("[iam] auto-provision failed:", e?.message || e);
      }
    }
  }

  if (user && forcedSuperadmin) {
    user = await repairProtectedSuperadminUser(user, email, payloadName);
  }

  const baseRolesRaw = Array.isArray(user?.roles) ? user.roles : [];
  const roleNames = new Set(
    [
      ...baseRolesRaw.map(normalizeRoleValue),
      ...headerRoles.map(normalizeRoleValue),
    ].filter(Boolean)
  );

  const permSet = new Set(
    [...(Array.isArray(user?.perms) ? user.perms : []), ...headerPerms]
      .map(normPerm)
      .filter(Boolean)
  );

  if (roleNames.size) {
    const roleCodes = [...roleNames];

    try {
      const roleDocs = await withTimeout(
        IamRole.find({
          $or: [
            { code: { $in: roleCodes } },
            { nameLower: { $in: roleCodes } },
            { name: { $in: roleCodes } },
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
      if (!IS_PROD && IAM_DEBUG) {
        console.warn("[iam] expand perms failed:", e?.message || e);
      }
    }
  }

  const isSuperAdmin = forcedSuperadmin;

  if (isSuperAdmin) {
    permSet.add("*");
    roleNames.add("admin");
    roleNames.add("superadmin");
    roleNames.delete(getDefaultVisitorRole());
  }

  const permissionsFinal = [...permSet];
  const permSetLower = new Set(permissionsFinal.map((p) => p.toLowerCase()));

  function has(perm) {
    if (isSuperAdmin) return true;
    if (!perm) return true;

    const raw = normPerm(perm);
    const low = raw.toLowerCase();

    if (raw === "*") {
      return permSet.has("*") || permSetLower.has("*");
    }

    return (
      permSet.has(raw) ||
      permSetLower.has(low) ||
      permSet.has("*") ||
      permSetLower.has("*")
    );
  }

  const defaultVisitorRole = getDefaultVisitorRole();
  const isVisitor = !isSuperAdmin && roleNames.has(defaultVisitorRole);

  const finalId = String(user?._id || user?.id || payloadSub || "").trim();

  const finalName = String(
    user?.name ||
      user?.nombreCompleto ||
      payloadName ||
      email?.split("@")[0] ||
      ""
  ).trim();

  return {
    _id: finalId,
    id: finalId,
    sub: finalId || payloadSub || "",
    userId: finalId,
    name: finalName,
    nombreCompleto: finalName,
    user,
    email,
    roles: [...roleNames],
    permissions: permissionsFinal,
    has,
    isSuperAdmin,
    isVisitor,
  };
}

/* =========================
   Middleware helpers
========================= */
export function devOr(mw) {
  const allow = !IS_PROD && String(process.env.IAM_DEV_ALLOW_ALL || "0") === "1";
  return (req, res, next) => (allow ? next() : mw(req, res, next));
}

/**
 * requirePerm:
 * - acepta string: "iam.roles.write"
 * - o array: ["iam.roles.write","iam.roles.manage"] (ANY-OF)
 */
export function requirePerm(perm) {
  const needList = Array.isArray(perm) ? perm : [perm];
  const need = needList
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return async (req, res, next) => {
    try {
      const ctx = req.iam || (await buildContextFrom(req));
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
          roles: ctx.roles || [],
          perms: ctx.permissions || [],
          visitor: !!ctx.isVisitor,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}