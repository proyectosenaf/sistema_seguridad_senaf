// server/src/middleware/auth.js
import { auth, requiredScopes } from "express-oauth2-jwt-bearer";
import { env } from "../config/env.js";

/**
 * Normaliza el dominio de Auth0 para formar el issuer:
 * - quita "https://"
 * - quita "/" finales
 */
function normalizeDomain(d) {
  if (!d) return "";
  let out = String(d).trim();
  out = out.replace(/^https?:\/\//i, "");
  out = out.replace(/\/+$/g, "");
  return out;
}

const domain = normalizeDomain(env?.auth0?.domain);
const audience = env?.auth0?.audience;

// Validaciones tempranas (salvo si desactivas auth explícitamente)
if (process.env.DISABLE_AUTH !== "1") {
  if (!domain) {
    console.warn(
      "[auth] WARNING: env.auth0.domain no está definido. " +
        "Define AUTH0_DOMAIN en tu .env o usa DISABLE_AUTH=1 para desactivar auth temporalmente."
    );
  }
  if (!audience) {
    console.warn(
      "[auth] WARNING: env.auth0.audience no está definido. " +
        "Define AUTH0_AUDIENCE en tu .env o usa DISABLE_AUTH=1 para desactivar auth temporalmente."
    );
  }
}

const issuerBaseURL = domain ? `https://${domain}` : undefined;

/**
 * Middleware principal: valida JWT RS256 con issuer y audience.
 * Si DISABLE_AUTH=1 → se desactiva y pasa directo (útil en dev).
 */
export const requireAuth =
  process.env.DISABLE_AUTH === "1"
    ? (_req, _res, next) => next()
    : auth({
        issuerBaseURL,
        audience,
        tokenSigningAlg: "RS256",
      });

// Alias por compatibilidad (rutas antiguas)
export { requireAuth as checkJwt };

/**
 * RBAC: verifica uno o varios scopes.
 * Acepta string o array de strings.
 */
export const requireScope = (scopes) =>
  requiredScopes(Array.isArray(scopes) ? scopes : [scopes]);

/**
 * Helper: obtiene un objeto de usuario amigable desde req.auth.payload
 */
export function getUserFromReq(req) {
  const p = req?.auth?.payload || {};

  // Namespace de roles (coincide con tu IAM_ROLES_NAMESPACE)
  const NS =
    process.env.AUTH0_NAMESPACE ||
    process.env.IAM_ROLES_NAMESPACE ||
    "https://senaf.local/roles";

  let roles =
    p[NS] ||
    p["https://senaf.local/roles"] ||
    p["https://senaf.example.com/roles"] ||
    p.roles ||
    [];

  if (!Array.isArray(roles)) roles = [roles].filter(Boolean);

  const permissions = Array.isArray(p.permissions) ? p.permissions : [];

  return {
    sub: p.sub ?? null,
    name: p.name ?? null,
    email: p.email ?? null,
    roles,
    permissions,
  };
}

/**
 * Helper: obtiene roles/perms desde req.user si existe (modo DEV u otros módulos)
 */
function getUserFromReqUser(req) {
  const NS =
    process.env.AUTH0_NAMESPACE ||
    process.env.IAM_ROLES_NAMESPACE ||
    "https://senaf.local/roles";

  const u = req?.user || {};

  let roles =
    (Array.isArray(u.roles) && u.roles) ||
    (Array.isArray(u[NS]) && u[NS]) ||
    [];

  if (!Array.isArray(roles)) roles = [roles].filter(Boolean);

  const permissions = Array.isArray(u.permissions) ? u.permissions : [];

  return {
    sub: u.sub ?? null,
    name: u.name ?? null,
    email: u.email ?? null,
    roles,
    permissions,
  };
}

/**
 * Middleware: exige que el usuario sea Admin (o tenga permiso "*").
 * En DEV:
 *   - si DISABLE_AUTH=1 o DEV_OPEN=1 (y no es production), se permite.
 * Además soporta identidad desde req.user (no solo req.auth.payload).
 */
export function requireAdmin(req, res, next) {
  const IS_PROD = process.env.NODE_ENV === "production";
  const DISABLE_AUTH = process.env.DISABLE_AUTH === "1";
  const DEV_OPEN = process.env.DEV_OPEN === "1";

  if (!IS_PROD && (DISABLE_AUTH || DEV_OPEN)) {
    return next();
  }

  const fromAuth = getUserFromReq(req);
  const fromReqUser = getUserFromReqUser(req);

  // Merge: si auth trae algo, úsalo; si no, usa req.user
  const roles = (fromAuth.roles?.length ? fromAuth.roles : fromReqUser.roles) || [];
  const permissions =
    (fromAuth.permissions?.length ? fromAuth.permissions : fromReqUser.permissions) || [];

  const normalizedRoles = roles.map((r) => String(r).toLowerCase());

  const isAdmin = normalizedRoles.includes("admin") || permissions.includes("*");

  if (!isAdmin) {
    return res.status(403).json({
      message: "Acceso restringido a administradores.",
      debug: {
        roles: normalizedRoles,
        permissions,
      },
    });
  }

  return next();
}

/**
 * Middleware opcional: inyecta user amigable en req.user (solo si ya pasó requireAuth).
 */
export function attachUser(req, _res, next) {
  req.user = getUserFromReq(req);
  next();
}
