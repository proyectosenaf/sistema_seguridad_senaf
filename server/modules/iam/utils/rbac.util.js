import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

// Importando jwt para accesos y seguridad en los roles, creado el 20/02/2026
import jwt from "jsonwebtoken";
// Importando jwt para accesos y seguridad en los roles, creado el 20/02/2026

// Log simple (ok)
console.log("[iam] boot", {
  NODE_ENV: process.env.NODE_ENV,
  IAM_DEV_ALLOW_ALL: process.env.IAM_DEV_ALLOW_ALL,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
  IAM_ALLOW_DEV_HEADERS: process.env.IAM_ALLOW_DEV_HEADERS,
  ROOT_ADMINS: process.env.ROOT_ADMINS,
});

export function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

//Usar el JWT para accesos creado el 20/02/2026, para obtener los roles y permisos del usuario autenticado
function getJwtPayload(req) {
  // intenta Auth0 o makeAuthMw (req.auth.payload)
  if (req?.auth?.payload) {
    return req.auth.payload;
  }

  // intenta JWT local si no hay payload (fallback)
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
  } catch {
    return null;
  }
}
//Usar el JWT para accesos creado el 20/02/2026, para obtener los roles y permisos del usuario autenticado

function getAuth0Sub(payload) {
  const sub = payload?.sub;
  return sub ? String(sub).trim() : null;
}

function getEmailFromPayload(payload) {
  if (!payload) return null;

  const direct = payload.email;
  if (direct) return String(direct).toLowerCase().trim();

  const ns = process.env.IAM_EMAIL_CLAIM || "https://senaf/email";
  const claimed = payload[ns];
  if (claimed) return String(claimed).toLowerCase().trim();

  return null;
}

/**
 * buildContextFrom(req)
 * - Auth0 / Local JWT: identidad por sub y/o email
 * - IAM: roles/perms desde MongoDB
 */
export async function buildContextFrom(req) {
  const payload = getJwtPayload(req);

  const auth0Sub = getAuth0Sub(payload);
  const jwtEmail = getEmailFromPayload(payload);

  const headerEmail = req?.headers?.["x-user-email"] || null;

  const IS_PROD = process.env.NODE_ENV === "production";
  const allowDevHeaders =
    !IS_PROD && String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

  const email = (jwtEmail || (allowDevHeaders ? headerEmail : null) || "")
    .toLowerCase()
    .trim() || null;

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

  // ───────────── AUTO-PROVISIONING (solo si hay JWT) ─────────────
  if (!user && payload) {
    const rootAdmins = parseList(process.env.ROOT_ADMINS || "").map((x) =>
      String(x).toLowerCase().trim()
    );

    const superEmail = String(process.env.SUPERADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    const isBootstrapAdmin =
      (!!email && email === superEmail) || (!!email && rootAdmins.includes(email));

    const doc = {
      active: true,
      provider: "auth0",
      roles: isBootstrapAdmin ? ["admin"] : ["visitor"],
      perms: isBootstrapAdmin ? ["*"] : [],
    };

    if (email) doc.email = email;
    if (auth0Sub) doc.auth0Sub = auth0Sub;

    if (doc.email || doc.auth0Sub) {
      try {
        const created = await IamUser.create(doc);
        user = created.toObject();
        console.log(
          `[iam] auto-provisioned: ${email || auth0Sub} (${
            isBootstrapAdmin ? "ADMIN" : "VISITOR"
          })`
        );
      } catch (e) {
        console.warn("[iam] auto-provision failed:", e?.message || e);
      }
    }
  }
  // ───────────── FIN AUTO-PROVISIONING ─────────────

  const roleNames = new Set([...(user?.roles || []), ...headerRoles]);

  const permSet = new Set([...(user?.perms || [])]);

  if (!user && allowDevHeaders) {
    headerPerms.forEach((p) => permSet.add(p));
  }

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

  const isVisitor = !!payload && !user;

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

      const payload = getJwtPayload(req);
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