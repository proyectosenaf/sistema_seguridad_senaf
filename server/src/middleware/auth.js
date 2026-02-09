// server/src/middleware/auth.js
import { auth } from "express-oauth2-jwt-bearer";
import { env } from "../config/env.js";

/* ----------------------------------------------------- */
/* Utils */
/* ----------------------------------------------------- */
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

function uniqLower(arr) {
  return Array.from(
    new Set(toArr(arr).map((x) => String(x).trim().toLowerCase()).filter(Boolean))
  );
}

function parsePermissionsFromPayload(p = {}) {
  // Auth0 RBAC: permissions viene como array si "Add Permissions in the Access Token" está ON
  let perms = Array.isArray(p.permissions) ? p.permissions : [];

  // Fallback: algunos setups usan "scope" (string)
  if ((!perms || perms.length === 0) && typeof p.scope === "string") {
    perms = p.scope.split(" ").map((s) => s.trim()).filter(Boolean);
  }

  return Array.from(new Set(perms));
}

/* ----------------------------------------------------- */
/* Env Auth0 */
/* ----------------------------------------------------- */
const domain = normalizeDomain(env?.auth0?.domain);
const audience = env?.auth0?.audience;
const issuerBaseURL = domain ? `https://${domain}` : undefined;

/* ----------------------------------------------------- */
/* JWT Validator */
/* ----------------------------------------------------- */
export const requireAuth =
  process.env.DISABLE_AUTH === "1"
    ? (_req, _res, next) => next()
    : auth({
        issuerBaseURL,
        audience,
        tokenSigningAlg: "RS256",
      });

export { requireAuth as checkJwt };

/* ----------------------------------------------------- */
/* Normalizador desde payload */
/* ----------------------------------------------------- */
export function getUserFromPayload(p = {}) {
  const NS =
    process.env.IAM_ROLES_NAMESPACE ||
    process.env.AUTH0_NAMESPACE ||
    "https://senaf/roles"; // ✅ define 1 y úsalo en todo

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

/* ----------------------------------------------------- */
/* Adjuntar usuario SIEMPRE (si hay JWT) */
/* ----------------------------------------------------- */
export function attachUser(req, _res, next) {
  if (req?.auth?.payload) {
    req.user = getUserFromPayload(req.auth.payload);
  }
  next();
}

/* ----------------------------------------------------- */
/* Admin Guard (solo para cosas ADMIN reales) */
/* ----------------------------------------------------- */
export function requireAdmin(req, res, next) {
  const IS_PROD = process.env.NODE_ENV === "production";
  const DISABLE_AUTH = process.env.DISABLE_AUTH === "1";
  const DEV_OPEN = process.env.DEV_OPEN === "1";

  // En DEV abierto, pasa
  if (!IS_PROD && (DISABLE_AUTH || DEV_OPEN)) return next();

  // Fallback robusto: si no hay req.user, usa payload
  const user =
    req.user ||
    (req?.auth?.payload ? getUserFromPayload(req.auth.payload) : null);

  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "No autenticado",
    });
  }

  const roles = uniqLower(user.roles);
  const perms = Array.isArray(user.permissions) ? user.permissions : [];

  const ok = roles.includes("admin") || perms.includes("*");

  if (!ok) {
    return res.status(403).json({
      ok: false,
      message: "Acceso solo para administradores",
      roles,
      perms,
    });
  }

  return next();
}
