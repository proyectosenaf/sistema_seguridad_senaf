// server/modules/iam/utils/auth.util.js
import { getBearer, verifyToken } from "./jwt.util.js";

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s || ""));
  } catch {
    return null;
  }
}

function parseCsv(s) {
  return String(s || "")
    .split(",")
    .map((x) => String(x).trim())
    .filter(Boolean);
}

function readDevIdentityFromHeaders(req) {
  // ✅ soporta tus headers ya usados en otros módulos (audit.util.js)
  const email =
    String(req?.headers?.["x-user-email"] || "")
      .trim()
      .toLowerCase() || null;

  const id = String(req?.headers?.["x-user-id"] || "").trim() || null;

  // roles/perms opcionales (si no vienen, no inventamos)
  // acepta JSON ["admin"] o CSV "admin,supervisor"
  const rolesRaw = req?.headers?.["x-user-roles"];
  const permsRaw = req?.headers?.["x-user-perms"];

  const rolesJson = safeJsonParse(rolesRaw);
  const permsJson = safeJsonParse(permsRaw);

  const roles = Array.isArray(rolesJson) ? rolesJson : parseCsv(rolesRaw);
  const perms = Array.isArray(permsJson) ? permsJson : parseCsv(permsRaw);

  if (!email && !id && !roles.length && !perms.length) return null;

  return {
    sub: id || undefined,
    email: email || undefined,
    roles,
    perms,
    permissions: perms, // compat
  };
}

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

    return (req, _res, next) => {
      // ✅ FIX: en modo disable, intenta hidratar identidad desde headers (si vienen)
      const devPayload = readDevIdentityFromHeaders(req);
      if (devPayload) {
        req.auth = req.auth || {};
        req.auth.payload = devPayload;
        if (attachToReqUser) req.user = req.user || devPayload;
      }
      return next();
    };
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
      return res.status(401).json({
        ok: false,
        error: errorMessage,
        details: String(e?.message || e),
      });
    }
  };
}

// ✅ compat default (para imports antiguos)
export default makeAuthMw;

// ✅ si en otros módulos importabas getBearer desde aquí, re-export para no romper
export { getBearer };