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

/* ----------------------------------------------------- */
/* Env Auth0 */
/* ----------------------------------------------------- */
const domain = normalizeDomain(env?.auth0?.domain);
const audience = env?.auth0?.audience;
const issuerBaseURL = domain ? `https://${domain}` : undefined;

/* ----------------------------------------------------- */
/* JWT Validator (Auth0 = autenticación) */
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
/* Normalizador desde payload (IDENTIDAD ÚNICAMENTE) */
/* ----------------------------------------------------- */
export function getAuthUserFromPayload(p = {}) {
  return {
    sub: p.sub || null,
    email: p.email || null,
    name: p.name || null,
  };
}

/**
 * attachAuthUser
 * - Copia identidad del JWT a req.authUser
 * - NO inventa roles/permisos aquí (eso es IAM)
 */
export function attachAuthUser(req, _res, next) {
  if (req?.auth?.payload) {
    req.authUser = getAuthUserFromPayload(req.auth.payload);
  }
  next();
}

/**
 * Helper
 */
export function getAuthUser(req) {
  return req?.authUser || null;
}
