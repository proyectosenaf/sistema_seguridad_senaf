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

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normStr(v) {
  return String(v || "").trim();
}

function normLower(v) {
  return normStr(v).toLowerCase();
}

/** Normaliza namespace base (sin slash final) */
function normalizeBaseNs(baseNs) {
  return normStr(baseNs).replace(/\/+$/g, "");
}

/** Construye claim namespaced: `${base}/roles`, `${base}/permissions`, `${base}/email` */
function claim(base, key) {
  const b = normalizeBaseNs(base);
  return b ? `${b}/${key}` : "";
}

/** Permissions: primero namespaced, luego estándar Auth0 RBAC, luego scope */
function parsePermissionsFromPayload(p = {}, baseNs) {
  const nsPerm = baseNs ? p[claim(baseNs, "permissions")] : undefined;

  // 1) Permissions namespaced (tu Action)
  let perms = Array.isArray(nsPerm) ? nsPerm : [];

  // 2) Auth0 RBAC: `permissions: [{permission_name}]` NO; suele ser string[] o en access token
  if ((!perms || perms.length === 0) && Array.isArray(p.permissions)) {
    perms = p.permissions;
  }

  // 3) scope (string)
  if ((!perms || perms.length === 0) && typeof p.scope === "string") {
    perms = p.scope
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 4) fallback: `perms` si alguien lo manda así
  if ((!perms || perms.length === 0) && Array.isArray(p.perms)) {
    perms = p.perms;
  }

  return uniq(perms.map((x) => normStr(x)).filter(Boolean));
}

/** Roles: namespaced primero, luego `roles`, luego `app_metadata.roles` (si viniera) */
function parseRolesFromPayload(p = {}, baseNs) {
  const nsRoles = baseNs ? p[claim(baseNs, "roles")] : undefined;

  let roles = toArr(nsRoles);

  if (!roles || roles.length === 0) {
    roles = toArr(p.roles);
  }

  // Algunos setups mandan roles en `https://senaf/roles` pero también en `role` etc.
  if (!roles || roles.length === 0) {
    roles = toArr(p.role);
  }

  roles = roles
    .map((r) => normLower(r))
    .filter(Boolean);

  return uniq(roles);
}

/* Env Auth0 */
const domain = normalizeDomain(env?.auth0?.domain || process.env.AUTH0_DOMAIN);
const audience = env?.auth0?.audience || process.env.AUTH0_AUDIENCE;

const issuerBaseURL =
  env?.auth0?.issuerBaseURL ||
  process.env.AUTH0_ISSUER_BASE_URL ||
  (domain ? `https://${domain}` : undefined);

const IS_PROD = process.env.NODE_ENV === "production";
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";

/**
 * Middleware JWT (Auth0 RS256).
 * - DISABLE_AUTH=1 => passthrough
 * - Si falta issuer/audience:
 *    - PROD => 500 (config incorrecta)
 *    - DEV  => passthrough (para no romper desarrollo)
 */
const realJwt =
  !issuerBaseURL || !audience
    ? (req, res, next) => {
        if (DISABLE_AUTH) return next();

        const msg =
          "[AUTH] Config incompleta: falta AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL (o env.auth0.*).";
        if (IS_PROD) return res.status(500).json({ ok: false, error: msg });
        console.warn(msg, { issuerBaseURL, audience });
        return next();
      }
    : auth({
        issuerBaseURL,
        audience,
        tokenSigningAlg: "RS256",
      });

/* JWT Validator */
export const requireAuth = DISABLE_AUTH ? (_req, _res, next) => next() : realJwt;

// alias útil (si en algún lado usas checkJwt)
export { requireAuth as checkJwt };

/**
 * Optional auth:
 * - Si NO hay Authorization Bearer => deja pasar (visitor)
 * - Si hay Bearer => valida (o bypass si DISABLE_AUTH=1)
 */
export function optionalAuth(req, res, next) {
  if (DISABLE_AUTH) return next();
  const h = String(req.headers.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return next();
  return requireAuth(req, res, next);
}

/**
 * Normalizador desde payload (Auth0)
 * - Lee claims namespaced: `${BASE_NS}/roles`, `${BASE_NS}/permissions`, `${BASE_NS}/email`
 * - Fallbacks: email, roles, permissions, scope
 */
export function getUserFromPayload(p = {}) {
  const BASE_NS =
    process.env.IAM_CLAIMS_NAMESPACE ||
    process.env.IAM_ROLES_NAMESPACE ||
    process.env.AUTH0_NAMESPACE ||
    "https://senaf";

  const baseNs = normalizeBaseNs(BASE_NS);

  const email =
    (baseNs && p[claim(baseNs, "email")]) ||
    p.email ||
    p["https://senaf/email"] ||
    p["https://senaf.local/email"] ||
    null;

  const roles = parseRolesFromPayload(p, baseNs);
  const permissions = parsePermissionsFromPayload(p, baseNs);

  return {
    sub: p.sub || null,
    email: email ? normLower(email) : null,
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
 * EXPORT que tu server.js espera:
 * import { requireAuth, attachAuthUser } from "./middleware/auth.js"
 */
export const attachAuthUser = attachUser;

/* Admin Guard (solo para cosas ADMIN reales) */
export function requireAdmin(req, res, next) {
  const DEV_OPEN = String(process.env.DEV_OPEN || "0") === "1";

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