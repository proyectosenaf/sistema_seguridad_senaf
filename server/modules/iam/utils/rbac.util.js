// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

// JWT local (HS256) para LoginLocal
import jwt from "jsonwebtoken";

console.log("[iam] boot", {
  NODE_ENV: process.env.NODE_ENV,
  IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
  IAM_ALLOW_DEV_HEADERS: process.env.IAM_ALLOW_DEV_HEADERS,
  ROOT_ADMINS: process.env.ROOT_ADMINS,
  IAM_EMAIL_CLAIM: process.env.IAM_EMAIL_CLAIM,
  IAM_CLAIMS_NAMESPACE: process.env.IAM_CLAIMS_NAMESPACE,
  IAM_DEFAULT_VISITOR_ROLE: process.env.IAM_DEFAULT_VISITOR_ROLE,
});

export function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extrae payload de 2 fuentes:
 * 1) Auth0 (RS256) -> req.auth.payload (ya verificado por makeAuthMw)
 * 2) Local JWT (HS256) -> Authorization Bearer + JWT_SECRET
 *
 * ✅ CLAVE: NO intentes verificar Auth0 RS256 con JWT_SECRET.
 */
function getJwtPayload(req) {
  // 1) Auth0 / middleware (ya verificado)
  if (req?.auth?.payload) {
    return { payload: req.auth.payload, source: "auth0" };
  }

  // 2) JWT local (HS256) fallback
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

/**
 * Lee email desde:
 * - payload.email (local JWT a veces)
 * - claim con namespace (Auth0): por defecto "https://senaf/email"
 * - opcional: namespace base + "email" (por si configuras "https://senaf/")
 */
function getEmailFromPayload(payload) {
  if (!payload) return null;

  if (payload.email) return String(payload.email).toLowerCase().trim();

  // 1) claim exacto configurable o por defecto tuyo
  const exact = String(process.env.IAM_EMAIL_CLAIM || "https://senaf/email").trim();
  if (exact && payload[exact]) {
    return String(payload[exact]).toLowerCase().trim();
  }

  // 2) Soporte por namespace (por si configuras "https://senaf/")
  const ns = String(process.env.IAM_CLAIMS_NAMESPACE || "https://senaf/").trim();
  const nsNorm = ns.endsWith("/") ? ns : `${ns}/`;
  const byNs = payload[`${nsNorm}email`];
  if (byNs) return String(byNs).toLowerCase().trim();

  return null;
}

function getDefaultVisitorRole() {
  return String(process.env.IAM_DEFAULT_VISITOR_ROLE || "visita")
    .trim()
    .toLowerCase();
}

/**
 * buildContextFrom(req)
 * - Identidad: Auth0 (req.auth.payload) o JWT local
 * - IAM: roles/perms desde MongoDB
 * - Auto-provision: crea usuario si viene identidad y no existe (rol default: visita)
 */
export async function buildContextFrom(req) {
  const { payload, source } = getJwtPayload(req);

  const auth0Sub = getAuth0Sub(payload);
  const jwtEmail = getEmailFromPayload(payload);

  // Dev headers (solo si se permite)
  const IS_PROD = process.env.NODE_ENV === "production";
  const allowDevHeaders =
    !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

  const headerEmail = allowDevHeaders ? req?.headers?.["x-user-email"] : null;

  // Email final: primero token, luego dev headers si aplica
  const email =
    (jwtEmail || headerEmail || "").toLowerCase().trim() || null;

  const headerRoles = allowDevHeaders ? parseList(req?.headers?.["x-roles"]) : [];
  const headerPerms = allowDevHeaders ? parseList(req?.headers?.["x-perms"]) : [];

  let user = null;

  // 1) buscar por auth0Sub
  if (auth0Sub) {
    user = await IamUser.findOne({ auth0Sub }).lean();
  }

  // 2) fallback por email
  if (!user && email) {
    user = await IamUser.findOne({ email }).lean();
  }

  /**
   * ✅ AUTO-PROVISIONING:
   * - Solo si hay identidad (payload) y tenemos email/sub
   * - Rol default: "visita"
   * - Bootstrap admin si el email coincide con SUPERADMIN o está en ROOT_ADMINS
   */
  const hasIdentity = !!payload && (!!email || !!auth0Sub);

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

    const defaultVisitorRole = getDefaultVisitorRole();

    const doc = {
      // tu schema exige email -> NO creamos si no hay email
      email: email || undefined,
      name: email ? email.split("@")[0] : undefined,
      auth0Sub: auth0Sub || undefined,
      active: true,
      provider: source === "local" ? "local" : "auth0",
      roles: isBootstrapAdmin ? ["admin"] : [defaultVisitorRole],
      perms: isBootstrapAdmin ? ["*"] : [],
    };

    if (doc.email) {
      try {
        const created = await IamUser.create(doc);
        user = created.toObject();
        console.log(
          `[iam] auto-provisioned: ${doc.email} (${
            isBootstrapAdmin ? "ADMIN" : defaultVisitorRole.toUpperCase()
          })`
        );
      } catch (e) {
        console.warn("[iam] auto-provision failed:", e?.message || e);
      }
    }
  }

  // Si existe usuario pero no tiene auth0Sub y ahora viene, lo guardamos
  // (ojo: user viene lean -> no tiene save; usamos updateOne)
  if (user && auth0Sub && !user.auth0Sub) {
    try {
      await IamUser.updateOne({ _id: user._id }, { $set: { auth0Sub } });
      user.auth0Sub = auth0Sub;
    } catch (e) {
      console.warn("[iam] could not attach auth0Sub:", e?.message || e);
    }
  }

  // Roles/perms combinados
  const roleNames = new Set([...(user?.roles || []), ...headerRoles]);

  // ✅ perms: usuario + (si permites) x-perms
  const permSet = new Set([...(user?.perms || [])]);
  if (allowDevHeaders) {
    headerPerms.forEach((p) => permSet.add(p));
  }

  // expand roles -> permissions desde IamRole
  if (roleNames.size) {
    const roleList = [...roleNames].map((r) => String(r).trim());
    const roleDocs = await IamRole.find({
      $or: [{ code: { $in: roleList } }, { name: { $in: roleList } }],
    }).lean();

    for (const r of roleDocs) {
      (r.permissions || []).forEach((p) => permSet.add(p));
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
    return permSet.has(perm);
  }

  // ✅ visitor: basado en rol default visita (no en "user null")
  const defaultVisitorRole = getDefaultVisitorRole();
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
  return (req, _res, next) => (allow ? next() : mw(req, _res, next));
}

export function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;

      const { payload } = getJwtPayload(req);
      if (!payload) {
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