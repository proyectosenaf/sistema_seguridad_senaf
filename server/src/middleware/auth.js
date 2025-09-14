import { auth, requiredScopes } from 'express-oauth2-jwt-bearer';
import { env } from '../config/env.js';

// ⚠️ Asegúrate que env.auth0.domain sea solo el dominio (sin https:// y sin "/" final)
//   p.ej.: dev-cxaghgedhfm03qw6.us.auth0.com
const issuerBaseURL = `https://${env.auth0.domain}`;
const audience      = env.auth0.audience;

// Export principal
export const requireAuth = auth({
  issuerBaseURL,          // sin "/" final
  audience,               // p.ej. "https://senaf"
  tokenSigningAlg: 'RS256',
});

// Alias por compatibilidad con rutas antiguas que usan checkJwt
export { requireAuth as checkJwt };

// Scopes RBAC (si los usas)
export const requireScope = (scopes) => requiredScopes(scopes);

// (Opcional) desactivar auth en dev: DISABLE_AUTH=1
export const maybeAuth =
  process.env.DISABLE_AUTH === '1' ? (_req, _res, next) => next() : requireAuth;
// Alias por compatibilidad con rutas antiguas que usan checkJwt