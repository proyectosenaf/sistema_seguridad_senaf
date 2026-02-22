import { makeAuthMw } from "./auth.util.js";

/**
 * Auth opcional:
 * - Si hay Bearer token -> intenta validarlo (req.auth.payload)
 * - Si no hay token -> sigue
 * - Si token inválido -> sigue (visitor)
 */
export function makeOptionalAuthMw() {
  const strict = makeAuthMw();

  return (req, res, next) => {
    const h = String(req.headers.authorization || "");
    const hasBearer = h.toLowerCase().startsWith("bearer ");
    if (!hasBearer) return next();

    strict(req, res, (err) => {
      // si falla validación, NO bloquea /me
      if (err) return next();
      return next();
    });
  };
}