// server/src/middleware/permissions.js

/**
 * Extrae roles y permisos desde:
 * - req.auth.payload   (Auth0 JWT)
 * - req.user           (cuando attachUser ya corrió)
 */
function extractIdentity(req) {
  const NS =
    process.env.AUTH0_NAMESPACE ||
    process.env.IAM_ROLES_NAMESPACE ||
    "https://senaf.local/roles";

  // Desde JWT Auth0
  const jwt = req?.auth?.payload || {};

  let roles =
    jwt[NS] ||
    jwt.roles ||
    req?.user?.roles ||
    [];

  if (!Array.isArray(roles)) roles = [roles];

  let permissions =
    jwt.permissions ||
    req?.user?.permissions ||
    [];

  if (!Array.isArray(permissions)) permissions = [permissions];

  return {
    roles: roles.map(r => String(r).toLowerCase()),
    permissions
  };
}

/**
 * Permite acceso si el usuario posee
 * al menos UNO de los permisos indicados
 */
export function requirePermission(...allowed) {
  return (req, res, next) => {
    const { permissions } = extractIdentity(req);

    const ok =
      permissions.includes("*") ||
      allowed.some(p => permissions.includes(p));

    if (!ok) {
      return res.status(403).json({
        message: "Permiso insuficiente",
        need: allowed,
        have: permissions
      });
    }

    next();
  };
}

/**
 * Permite acceso si el usuario tiene
 * alguno de los roles indicados
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    const { roles } = extractIdentity(req);

    const ok =
      roles.includes("admin") ||
      allowed.some(r => roles.includes(r.toLowerCase()));

    if (!ok) {
      return res.status(403).json({
        message: "Rol insuficiente",
        need: allowed,
        have: roles
      });
    }

    next();
  };
}

/**
 * Atajo para administrador
 */
export function requireAdmin(req, res, next) {
  const { roles, permissions } = extractIdentity(req);

  const ok =
    roles.includes("admin") ||
    permissions.includes("*");

  if (!ok) {
    return res.status(403).json({
      message: "Solo administradores",
      roles,
      permissions
    });
  }

  next();
}
