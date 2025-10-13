import { auth as requireJwt } from "express-oauth2-jwt-bearer";

export function makeAuthMw() {
  const enabled = !!(process.env.AUTH0_AUDIENCE && process.env.AUTH0_ISSUER_BASE_URL);
  return enabled
    ? requireJwt({
        audience: process.env.AUTH0_AUDIENCE,
        issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
        tokenSigningAlg: "RS256"
      })
    : (_req,_res,next)=>next();
}
