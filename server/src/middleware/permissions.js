// server/src/middleware/permissions.js

function toArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function uniqLower(arr) {
  return Array.from(
    new Set(toArr(arr).map((x) => String(x).trim().toLowerCase()).filter(Boolean))
  );
}

function parsePermissions(req) {
  const jwt = req?.auth?.payload || {};
  const u = req?.user || {};

  // Preferir permissions array, si no, scope string
  let perms =
    (Array.isArray(jwt.permissions) && jwt.permissions) ||
    (Array.isArray(u.permissions) && u.permissions) ||
    [];

  if ((!perms || perms.length === 0) && typeof jwt.scope === "string") {
    perms = jwt.scope.split(" ").map((s) => s.trim()).filter(Boolean);
  }

  return Array.from(new Set(perms));
}

/**
 * Extrae roles y permisos desde:
 * - req.auth.payload (JWT)
 * - req.user         (si attachUser corrió)
 */
function extractIdentity(req) {
  const NS =
    process.env.IAM_ROLES_NAMESPACE ||
    process.env.AUTH0_NAMESPACE ||
    "https://senaf/roles";

  const jwt = req?.auth?.payload || {};
  const u = req?.user || {};

  const rolesRaw =
    jwt[NS] ||
    jwt["https://senaf/roles"] ||
    jwt["https://senaf.local/roles"] ||
    jwt.roles ||
    u.roles ||
    u[NS] ||
    [];

  const roles = uniqLower(rolesRaw);
  const permissions = parsePermissions(req);

  return { roles, permissions };
}

/**
 * Permite acceso si el usuario posee al menos UNO de los permisos indicados
 */
export function requirePermission(...allowed) {
  return (req, res, next) => {
    const { permissions } = extractIdentity(req);

    const ok =
      permissions.includes("*") ||
      allowed.some((p) => permissions.includes(p));

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Permiso insuficiente",
        need: allowed,
        have: permissions,
      });
    }

    next();
  };
}

/**
 * Permite acceso si el usuario tiene alguno de los roles indicados
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    const { roles, permissions } = extractIdentity(req);

    const ok =
      roles.includes("admin") ||
      permissions.includes("*") ||
      allowed.some((r) => roles.includes(String(r).toLowerCase()));

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Rol insuficiente",
        need: allowed,
        have: roles,
      });
    }

    next();
  };
}

/**
 * Atajo admin (solo si realmente quieres admin/*)
 */
export function requireAdmin(req, res, next) {
  const { roles, permissions } = extractIdentity(req);

  const ok = roles.includes("admin") || permissions.includes("*");

  if (!ok) {
    return res.status(403).json({
      ok: false,
      message: "Solo administradores",
      roles,
      permissions,
    });
  }

  next();
}
