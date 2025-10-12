import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

/** Fusiona roles (de usuario y cabeceras DEV) y obtiene permisos efectivos */
export async function buildContextFrom(req) {
  const email = req?.auth?.payload?.email || req.headers["x-user-email"] || null;
  const headerRoles = parseList(req.headers["x-roles"]);
  const headerPerms = parseList(req.headers["x-perms"]);

  let user = email ? await IamUser.findOne({ email }).lean() : null;

  const roleNames = new Set([...(user?.roles||[]), ...headerRoles]);
  const permSet  = new Set([...(user?.perms||[])]);

  // solo si no hay usuario, acepta permisos desde headers (dev)
  if (!user) headerPerms.forEach(p=>permSet.add(p));

  if (roleNames.size) {
    const roleDocs = await IamRole.find({ name: { $in: [...roleNames] } }).lean();
    roleDocs.forEach(r => (r.permissions||[]).forEach(p => permSet.add(p)));
  }
  return {
    user, roles: [...roleNames], permissions: [...permSet],
    has: (p)=> permSet.has("*") || permSet.has(p)
  };
}

export function parseList(v) {
  if (!v) return [];
  return String(v).split(/[,\s]+/).map(s=>s.trim()).filter(Boolean);
}

export function devOr(mw) {
  const allow = process.env.IAM_DEV_ALLOW_ALL === "1" || process.env.NODE_ENV !== "production";
  return (req,res,next)=> allow ? next() : mw(req,res,next);
}

export function requirePerm(perm) {
  return async (req,res,next) => {
    try {
      const ctx = await buildContextFrom(req);
      req.iam = ctx;
      if (!ctx.has(perm)) return res.status(403).json({ message: "forbidden", need: perm });
      next();
    } catch (e) {
      next(e);
    }
  };
}
