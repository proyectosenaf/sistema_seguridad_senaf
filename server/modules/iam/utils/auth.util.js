// server/modules/iam/utils/auth.util.js
import { getBearer, verifyToken } from "./jwt.util.js";

/**
 * makeAuthMw(options?)
 * - required: true => 401 si no hay token o inválido
 * - required: false => si no hay token -> next() sin req.auth
 * - attachToReqUser: true => req.user = payload (compat)
 *
 * NOTA:
 * - Siempre deja payload en req.auth.payload para reutilizarlo en buildContextFrom
 */
export function makeAuthMw(options = {}) {
  const {
    required = true,
    attachToReqUser = true,
    errorMessage = "Unauthorized",
  } = options;

  const disableAuth = process.env.DISABLE_AUTH === "1";

  // ✅ Si DISABLE_AUTH=1, no bloquea y no valida token
  if (disableAuth) {
    console.warn("[AUTH] DISABLE_AUTH=1 → JWT deshabilitado");
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const token = getBearer(req);

    if (!token) {
      if (!required) return next();
      return res.status(401).json({ ok: false, error: errorMessage });
    }

    try {
      const payload = verifyToken(token);

      req.auth = req.auth || {};
      req.auth.payload = payload;

      if (attachToReqUser) req.user = req.user || payload;

      return next();
    } catch (e) {
      if (!required) return next();
      return res.status(401).json({ ok: false, error: errorMessage });
    }
  };
}

// ✅ compat default (para imports antiguos)
export default makeAuthMw;

// ✅ si en otros módulos importabas getBearer desde aquí, re-export para no romper
export { getBearer };