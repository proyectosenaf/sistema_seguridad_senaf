// server/modules/iam/utils/auth.util.js
/**
 * Middleware simple para DEV.
 * - Lee x-user-id, x-roles, x-perms del header o deja defaults.
 * - En prod, reemplázalo por tu validador de JWT/Auth0.
 */

export function requireAuth(req, _res, next) {
  const uid = req.headers["x-user-id"] || req.user?.sub || "dev-user";
  const roles = String(req.headers["x-roles"] || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const perms = String(req.headers["x-perms"] || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  req.user = {
    id: uid,
    roles,
    perms,
  };
  next();
}

/** requirePerm("iam.users.manage") */
export function requirePerm(perm) {
  return (req, res, next) => {
    const has =
      req.user?.perms?.includes(perm) ||
      req.user?.roles?.includes("admin"); // atajo para admin
    if (!has) return res.status(403).json({ ok: false, error: "forbidden" });
    next();
  };
}
