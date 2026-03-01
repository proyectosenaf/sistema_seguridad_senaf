// server/modules/iam/utils/optionalAuth.util.js
import { makeAuthMw, getBearer } from "./auth.util.js";

/**
 * Optional auth:
 * - Si NO hay Authorization Bearer -> next()
 * - Si hay Bearer -> valida; si inválido -> next() (no bloquea)
 *
 * Nota:
 * - Si DISABLE_AUTH=1, makeAuthMw(required=false) ya hace next()
 */
export function makeOptionalAuthMw() {
  // required:false => no 401 nunca
  const authMw = makeAuthMw({ required: false });

  return (req, res, next) => {
    // si no hay bearer, no intentes validar
    const token = getBearer(req);
    if (!token) return next();

    // si hay bearer, valida (si falla, authMw no bloquea)
    return authMw(req, res, next);
  };
}

export default makeOptionalAuthMw;