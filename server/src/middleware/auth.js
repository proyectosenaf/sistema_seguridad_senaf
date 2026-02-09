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
  const roles =
    p["https://senaf/roles"] ||
    p["https://senaf.local/roles"] ||
    p.roles ||
    [];

  const permissions = Array.isArray(p.permissions) ? p.permissions : [];

  return {
    sub: p.sub || null,
    email: p.email || null,
    name: p.name || null,
    roles: Array.isArray(roles) ? roles : [roles],
    permissions,
  };
}

/* ----------------------------------------------------- */
/* Adjuntar usuario SIEMPRE */
/* ----------------------------------------------------- */

export function attachUser(req, _res, next) {
  if (req.auth?.payload) {
    req.user = getUserFromPayload(req.auth.payload);
  }
  next();
}

/* ----------------------------------------------------- */
/* Admin Guard */
/* ----------------------------------------------------- */

export function requireAdmin(req, res, next) {
  const IS_PROD = process.env.NODE_ENV === "production";
  const DISABLE_AUTH = process.env.DISABLE_AUTH === "1";

  if (!IS_PROD && DISABLE_AUTH) return next();

  const user = req.user;

  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "No autenticado",
    });
  }

  const roles = user.roles.map(r => String(r).toLowerCase());
  const perms = user.permissions;

  if (roles.includes("admin") || perms.includes("*")) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    message: "Acceso solo para administradores",
    roles,
    perms,
  });
}
