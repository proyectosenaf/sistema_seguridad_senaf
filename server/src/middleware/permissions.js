// server/src/middleware/permissions.js

/**
 * Extrae roles/permisos desde:
 * - req.auth.payload (JWT validado por express-oauth2-jwt-bearer)
 * - req.user         (si attachUser / bridge ya corrió)
 *
 * Soporta:
 * - roles en namespaces: IAM_ROLES_NAMESPACE, AUTH0_NAMESPACE, https://senaf/roles, https://senaf.local/roles
 * - permisos en:
 *   - payload.permissions (RBAC + "Add Permissions in the Access Token")
 *   - payload.scope (string) -> se parsea a array
 *   - req.user.permissions
 */
function toArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function uniqLower(arr) {
  return Array.from(
    new Set(
      toArr(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function uniq(arr) {
  return Array.from(
    new Set(
      toArr(arr)
        .map((x) => String(x).trim())
        .filter(Boolean)
    )
  );
}

function parseScopeToPerms(scope) {
  // Auth0 suele mandar scope como string: "openid profile email read:users ..."
  if (!scope || typeof scope !== "string") return [];
  return scope
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 🔑 Fuente única de verdad para extraer identidad
 */
export function extractIdentity(req) {
  const jwt = req?.auth?.payload || {};
  const user = req?.user || {};

  // Roles namespaces posibles (en orden de prioridad)
  const NS_ENV =
    process.env.AUTH0_NAMESPACE ||
    process.env.IAM_ROLES_NAMESPACE ||
    "";

  const ROLE_KEYS = [
    NS_ENV, // si lo defines, se intenta primero
    "https://senaf/roles",
    "https://senaf.local/roles",
    "https://senaf.example.com/roles",
  ].filter(Boolean);

  // roles desde jwt primero
  let roles = [];
  for (const k of ROLE_KEYS) {
    if (jwt[k]) {
      roles = jwt[k];
      break;
    }
  }
  // fallback roles “planos”
  if (!roles.length && jwt.roles) roles = jwt.roles;
  if (!roles.length && user.roles) roles = user.roles;

  const rolesNorm = uniqLower(roles);

  // permisos: Auth0 RBAC -> payload.permissions (array)
  let permissions = [];
  if (Array.isArray(jwt.permissions)) permissions = jwt.permissions;
  else if (Array.isArray(user.permissions)) permissions = user.permissions;
  else permissions = [];

  // fallback: scope (string)
  const scopePerms = parseScopeToPerms(jwt.scope);
  const permsAll = uniq([...permissions, ...scopePerms]);

  return { roles: rolesNorm, permissions: permsAll };
}

/**
 * ✅ Permite acceso si el usuario posee AL MENOS UNO de los permisos indicados.
 * Soporta "*".
 */
export function requirePermission(...allowed) {
  const need = allowed.map(String).filter(Boolean);

  return (req, res, next) => {
    const { permissions, roles } = extractIdentity(req);

    // admin por rol también puede pasar (opcional, útil)
    const ok =
      permissions.includes("*") ||
      roles.includes("admin") ||
      need.some((p) => permissions.includes(p));

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Permiso insuficiente",
        need,
        have: permissions,
        roles,
      });
    }

    next();
  };
}

/**
 * ✅ Permite acceso si el usuario tiene AL MENOS UNO de los roles indicados.
 * Admin siempre pasa.
 */
export function requireRole(...allowed) {
  const need = allowed.map((r) => String(r).toLowerCase()).filter(Boolean);

  return (req, res, next) => {
    const { roles, permissions } = extractIdentity(req);

    const ok =
      roles.includes("admin") ||
      permissions.includes("*") ||
      need.some((r) => roles.includes(r));

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Rol insuficiente",
        need,
        have: roles,
        permissions,
      });
    }

    next();
  };
}

/**
 * ✅ Permite acceso si cumple al menos UNO de:
 * - permisos listados
 * - roles listados
 *
 * Ej:
 * anyOf({ perms: ["iam.users.manage"], roles: ["ti"] })
 */
export function anyOf({ perms = [], roles = [] } = {}) {
  const needPerms = perms.map(String).filter(Boolean);
  const needRoles = roles.map((r) => String(r).toLowerCase()).filter(Boolean);

  return (req, res, next) => {
    const id = extractIdentity(req);

    const ok =
      id.permissions.includes("*") ||
      id.roles.includes("admin") ||
      needPerms.some((p) => id.permissions.includes(p)) ||
      needRoles.some((r) => id.roles.includes(r));

    if (!ok) {
      return res.status(403).json({
        ok: false,
        message: "Acceso denegado",
        need: { perms: needPerms, roles: needRoles },
        have: { perms: id.permissions, roles: id.roles },
      });
    }

    next();
  };
}

/**
 * ✅ Permite acceso si cumple TODOS los permisos/roles requeridos.
 * Admin o "*" bypass.
 *
 * Ej:
 * allOf({ perms: ["incidentes.read","incidentes.create"] })
 */
export function allOf({ perms = [], roles = [] } = {}) {
  const needPerms = perms.map(String).filter(Boolean);
  const needRoles = roles.map((r) => String(r).toLowerCase()).filter(Boolean);

  return (req, res, next) => {
    const id = extractIdentity(req);

    const bypass = id.permissions.includes("*") || id.roles.includes("admin");
    if (bypass) return next();

    const okPerms = needPerms.every((p) => id.permissions.includes(p));
    const okRoles = needRoles.every((r) => id.roles.includes(r));

    if (!(okPerms && okRoles)) {
      return res.status(403).json({
        ok: false,
        message: "Acceso denegado (requisitos no cumplidos)",
        need: { perms: needPerms, roles: needRoles },
        have: { perms: id.permissions, roles: id.roles },
      });
    }

    next();
  };
}

/**
 * ✅ Atajo admin (renombrado para no chocar con auth.js)
 * - rol admin o permiso "*"
 */
export function requireAdminAccess(req, res, next) {
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
