// server/modules/iam/utils/auth.util.js
import { auth as requireJwt } from "express-oauth2-jwt-bearer";

export function makeAuthMw() {
  const disableAuth = process.env.DISABLE_AUTH === "1";

  if (disableAuth) {
    console.warn("[AUTH] DISABLE_AUTH=1 → JWT deshabilitado");
    return (_req, _res, next) => next();
  }

  if (!process.env.AUTH0_AUDIENCE || !process.env.AUTH0_ISSUER_BASE_URL) {
    console.warn(
      "[AUTH] Faltan AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL → JWT deshabilitado"
    );
    return (_req, _res, next) => next();
  }

  console.log("[AUTH] JWT Auth0 activo");

  return requireJwt({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: "RS256",
  });
}
