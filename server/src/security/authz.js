// server/src/security/authz.js
import { requireAuth as baseRequireAuth } from "../middleware/auth.js";

/**
 * Normaliza roles / scopes a partir del payload del token (req.auth.payload)
 */
function normalizeAuthFromPayload(decoded = {}) {
  const email = decoded.email || decoded["user_email"] || null;
  const name = decoded.name || decoded["user_name"] || null;
  const sub = decoded.sub || null;

  // Namespace configurable para roles
  const NS =
    process.env.AUTH0_NAMESPACE ||
    process.env.IAM_ROLES_NAMESPACE ||
    "https://senaf.local/roles";

  let roles =
    decoded[NS] ||
    decoded["https://senaf.local/roles"] ||
    decoded["https://senaf.example.com/roles"] ||
    decoded.roles ||
    [];

  if (!Array.isArray(roles)) {
    roles = [roles].filter(Boolean);
  }

  // Scopes / Permissions
  const scopesSet = new Set();

  // scope: "openid profile email ronda:read"
  if (typeof decoded.scope === "string") {
    decoded.scope
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => scopesSet.add(s));
  }

  // scp: ["ronda:read", "ronda:write"]
  if (Array.isArray(decoded.scp)) {
    decoded.scp
      .map((s) => String(s).trim())
      .filter(Boolean)
      .forEach((s) => scopesSet.add(s));
  }

  // permissions: Auth0 RBAC (si marcaste "Add permissions in the access token")
  if (Array.isArray(decoded.permissions)) {
    decoded.permissions
      .map((s) => String(s).trim())
      .filter(Boolean)
      .forEach((s) => scopesSet.add(s));
  }

  const scopes = Array.from(scopesSet);

  return {
    sub,
    email,
    name,
    roles,
    scopes,
    raw: decoded,
  };
}

/**
 * Asegura que req.user esté poblado a partir de req.auth.payload
 */
function ensureUserFromAuth(req) {
  if (!req.auth || !req.auth.payload) {
    return null;
  }
  const user = normalizeAuthFromPayload(req.auth.payload);
  req.user = user;
  return user;
}

/**
 * 🔒 requireAuth
 * Envuelve al requireAuth de express-oauth2-jwt-bearer y además
 * normaliza req.user con roles/scopes.
 *
 * Úsalo en rutas antiguas que hacían:
 *   import { requireAuth } from "../security/authz.js";
 */
export function requireAuth(req, res, next) {
  return baseRequireAuth(req, res, (err) => {
    if (err) {
      // Delegamos al manejador de errores global
      return next(err);
    }

    if (!req.auth || !req.auth.payload) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    ensureUserFromAuth(req);
    return next();
  });
}

/**
 * Helper interno para leer user siempre normalizado,
 * incluso si solo pasó por optionalAuth.
 */
function getUser(req) {
  if (!req.user && req.auth && req.auth.payload) {
    ensureUserFromAuth(req);
  }
  return req.user || { roles: [], scopes: [] };
}

/**
 * 🔒 requireRole("admin")
 * Permite acceso solo si el user tiene ese rol.
 *
 * ⚠️ Comportamiento:
 *  - Si el usuario tiene rol "admin" → se considera que puede pasar
 *    cualquier requireRole(...) (rol administrador global).
 */
export function requireRole(role) {
  const target = String(role).toLowerCase();

  return function (req, res, next) {
    const user = getUser(req);
    const roles = (user.roles || []).map((r) => String(r).toLowerCase());

    // admin siempre pasa
    if (roles.includes("admin")) {
      return next();
    }

    if (!roles.includes(target)) {
      return res.status(403).json({ error: `Requires role: ${role}` });
    }
    next();
  };
}

/**
 * 🔒 requireAnyRole(["admin","supervisor"])
 *
 * ⚠️ admin siempre pasa como rol global.
 */
export function requireAnyRole(roles) {
  const targets = (roles || []).map((r) => String(r).toLowerCase());

  return function (req, res, next) {
    const user = getUser(req);
    const userRoles = (user.roles || []).map((r) => String(r).toLowerCase());

    if (userRoles.includes("admin")) {
      // admin es rol global
      return next();
    }

    const ok = userRoles.some((r) => targets.includes(r));
    if (!ok) {
      return res.status(403).json({
        error: `Requires any role: ${roles.join(",")}`,
      });
    }
    next();
  };
}

/**
 * 🔒 requireScope("rondas:read")
 *
 * ⚠️ Si el usuario tiene:
 *  - rol "admin" → pasa siempre
 *  - scope "*"   → pasa siempre
 *  - sino → debe tener el scope específico
 */
export function requireScope(scope) {
  const target = String(scope).trim();

  return function (req, res, next) {
    const user = getUser(req);
    const roles = (user.roles || []).map((r) => String(r).toLowerCase());
    const scopes = user.scopes || [];

    // admin o scope global "*" pasan siempre
    if (roles.includes("admin") || scopes.includes("*")) {
      return next();
    }

    if (!scopes.includes(target)) {
      return res
        .status(403)
        .json({ error: `Requires scope: ${scope}` });
    }
    next();
  };
}

/**
 * Helpers para usar en controllers
 *
 * ⚠️ En ambos helpers:
 *  - Si el usuario tiene rol "admin" se considera que "sí tiene" cualquier rol/scope.
 *  - Si tiene scope "*" también se considera que "sí tiene" cualquier scope.
 */
export function hasRole(req, role) {
  const user = getUser(req);
  const roles = (user.roles || []).map((r) => String(r).toLowerCase());
  const target = String(role).toLowerCase();

  if (roles.includes("admin")) return true;
  return roles.includes(target);
}

export function hasScope(req, scope) {
  const user = getUser(req);
  const roles = (user.roles || []).map((r) => String(r).toLowerCase());
  const scopes = user.scopes || [];
  const target = String(scope).trim();

  if (roles.includes("admin")) return true;
  if (scopes.includes("*")) return true;

  return scopes.includes(target);
}
