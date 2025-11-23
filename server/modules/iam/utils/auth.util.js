// server/utils/auth.util.js (por ejemplo)
import { auth as requireJwt } from "express-oauth2-jwt-bearer";

/**
 * Crea un middleware de autenticación basado en Auth0.
 *
 * - Si AUTH0_AUDIENCE y AUTH0_ISSUER_BASE_URL están definidos → valida JWT.
 * - Si falta alguno → no valida (modo dev / sin auth).
 * - Si DISABLE_AUTH === "1" → fuerza modo sin auth aunque haya variables.
 *
 * En caso de éxito, express-oauth2-jwt-bearer setea:
 *   req.auth = { header, payload, token }
 */
export function makeAuthMw() {
  const hasAudience = !!process.env.AUTH0_AUDIENCE;
  const hasIssuer = !!process.env.AUTH0_ISSUER_BASE_URL;
  const disableAuth = process.env.DISABLE_AUTH === "1";

  if (disableAuth) {
    console.warn("[AUTH] DISABLE_AUTH=1 → JWT deshabilitado (modo dev/relajado).");
    return (_req, _res, next) => next();
  }

  const enabled = hasAudience && hasIssuer;

  if (!enabled) {
    console.warn(
      "[AUTH] JWT deshabilitado: faltan AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL. " +
        "Las rutas protegidas pasarán sin validar token."
    );
    return (_req, _res, next) => next();
  }

  console.log(
    "[AUTH] JWT habilitado con Auth0. Audience=%s, Issuer=%s",
    process.env.AUTH0_AUDIENCE,
    process.env.AUTH0_ISSUER_BASE_URL
  );

  // Middleware real: valida Authorization: Bearer <token>
  return requireJwt({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: "RS256",
  });
}
