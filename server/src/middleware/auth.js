// src/middleware/auth.js
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
        // Estos campos deben existir en producción
        issuerBaseURL,
        audience,
        tokenSigningAlg: "RS256",
      });

// Alias por compatibilidad (rutas antiguas)
export { requireAuth as checkJwt };

/**
 * RBAC: verifica uno o varios scopes.
 * Acepta string o array de strings.
 * Ej: requireScope("read:rondas") o requireScope(["read:rondas","write:rondas"])
 */
export const requireScope = (scopes) =>
  requiredScopes(Array.isArray(scopes) ? scopes : [scopes]);

/**
 * Helper opcional: obtiene un objeto de usuario amigable desde req.auth.payload
 * Útil en controllers si quieres registrar quién hizo la acción.
 */
export function getUserFromReq(req) {
  const p = req?.auth?.payload || {};
  return {
    sub: p.sub ?? null,
    name: p.name ?? null,
    email: p.email ?? null,
    // agrega aquí claims personalizados si los mapeas en Auth0 (e.g., roles/permissions)
    permissions: p.permissions ?? [],
  };
}

/**
 * Middleware opcional: inyecta user amigable en req.user (solo si ya pasó requireAuth).
 * Si tienes rutas que ya usan `req.user`, puedes usarlo.
 */
// export function attachUser(req, _res, next) {
//   req.user = getUserFromReq(req);
//   next();
// }
