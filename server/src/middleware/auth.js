// server/src/middleware/auth.js
import { auth } from "express-oauth2-jwt-bearer";
import { env } from "../config/env.js";

/* Utils */
function normalizeDomain(d) {
  if (!d) return "";
  return String(d)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .trim();
}

function toArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parsePermissionsFromPayload(p = {}) {
  let perms = Array.isArray(p.permissions) ? p.permissions : [];
  if ((!perms || perms.length === 0) && typeof p.scope === "string") {
    perms = p.scope
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return Array.from(new Set(perms));
}

/* Env Auth0 */
const domain = normalizeDomain(env?.auth0?.domain || process.env.AUTH0_DOMAIN);
const audience = env?.auth0?.audience || process.env.AUTH0_AUDIENCE;
const issuerBaseURL =
  env?.auth0?.issuerBaseURL ||
  process.env.AUTH0_ISSUER_BASE_URL ||
  (domain ? `https://${domain}` : undefined);

/* JWT Validator */
export const requireAuth =
  process.env.DISABLE_AUTH === "1"
    ? (_req, _res, next) => next()
    : auth({
        issuerBaseURL,
        audience,
        tokenSigningAlg: "RS256",
      });

// alias útil (si en algún lado usas checkJwt)
export { requireAuth as checkJwt };

/* Normalizador desde payload */
export function getUserFromPayload(p = {}) {
  const NS =
    process.env.IAM_ROLES_NAMESPACE ||
    process.env.AUTH0_NAMESPACE ||
    "https://senaf/roles";

  const rolesRaw =
    p[NS] ||
    p["https://senaf/roles"] ||
    p["https://senaf.local/roles"] ||
    p.roles ||
    [];

  const roles = toArr(rolesRaw).filter(Boolean);
  const permissions = parsePermissionsFromPayload(p);

  return {
    sub: p.sub || null,
    email: p.email || null,
    name: p.name || null,
    roles,
    permissions,
  };
}

/**
 * Adjuntar usuario si hay JWT decodificado por express-oauth2-jwt-bearer
 * (eso deja req.auth.payload).
 */
export function attachUser(req, _res, next) {
  if (req?.auth?.payload) {
    req.user = getUserFromPayload(req.auth.payload);
  }
  next();
}

/**
 * ✅ EXPORT que tu server.js espera:
 * import { requireAuth, attachAuthUser } from "./middleware/auth.js"
 */
export const attachAuthUser = attachUser;

/* Admin Guard (solo para cosas ADMIN reales) */
export function requireAdmin(req, res, next) {
  const IS_PROD = process.env.NODE_ENV === "production";
  const DISABLE_AUTH = process.env.DISABLE_AUTH === "1";
  const DEV_OPEN = process.env.DEV_OPEN === "1";

  if (!IS_PROD && (DISABLE_AUTH || DEV_OPEN)) return next();

  const user =
    req.user ||
    (req?.auth?.payload ? getUserFromPayload(req.auth.payload) : null);

  if (!user) {
    return res.status(401).json({ ok: false, message: "No autenticado" });
  }

  const roles = (user.roles || []).map((r) => String(r).toLowerCase());
  const perms = Array.isArray(user.permissions) ? user.permissions : [];

  if (roles.includes("admin") || perms.includes("*")) return next();

  return res.status(403).json({
    ok: false,
    message: "Acceso solo para administradores",
    roles,
    perms,
  });
}
