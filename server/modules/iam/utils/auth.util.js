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

function normalizeArray(arr) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );
}

function readDevIdentityFromHeaders(req) {
  const email =
    String(req?.headers?.["x-user-email"] || "")
      .trim()
      .toLowerCase() || null;

  const id = String(req?.headers?.["x-user-id"] || "").trim() || null;

  const rolesRaw = req?.headers?.["x-user-roles"];
  const permsRaw = req?.headers?.["x-user-perms"];

  const rolesJson = safeJsonParse(rolesRaw);
  const permsJson = safeJsonParse(permsRaw);

  const roles = normalizeArray(
    Array.isArray(rolesJson) ? rolesJson : parseCsv(rolesRaw)
  );

  const perms = normalizeArray(
    Array.isArray(permsJson) ? permsJson : parseCsv(permsRaw)
  );

  if (!email && !id && !roles.length && !perms.length) return null;

  return {
    sub: id || undefined,
    email: email || undefined,
    roles,
    perms,
    permissions: perms,
    provider: "local",
  };
}

/**
 * makeAuthMw(options?)
 * - required: true => 401 si no hay token o inválido
 * - required: false => si no hay token -> next() sin req.auth
 * - attachToReqUser: true => req.user = payload (compat)
 *
 * Siempre deja payload en req.auth.payload.
 */
export function makeAuthMw(options = {}) {
  const {
    required = true,
    attachToReqUser = true,
    errorMessage = "Unauthorized",
  } = options;

  const disableAuth = String(process.env.DISABLE_AUTH || "0") === "1";

  if (disableAuth) {
    console.warn("[AUTH] DISABLE_AUTH=1 → JWT deshabilitado");

    return (req, _res, next) => {
      const devPayload = readDevIdentityFromHeaders(req);

      if (devPayload) {
        req.auth = req.auth || {};
        req.auth.payload = {
          ...(req.auth.payload || {}),
          ...devPayload,
        };

        if (attachToReqUser) {
          req.user = {
            ...(req.user || {}),
            ...req.auth.payload,
          };
        }
      }

      return next();
    };
  }

  return (req, res, next) => {
    const token = getBearer(req);

    if (!token) {
      if (!required) {
        const devPayload = readDevIdentityFromHeaders(req);

        if (devPayload) {
          req.auth = req.auth || {};
          req.auth.payload = {
            ...(req.auth.payload || {}),
            ...devPayload,
          };

          if (attachToReqUser) {
            req.user = {
              ...(req.user || {}),
              ...req.auth.payload,
            };
          }
        }

        return next();
      }

      return res.status(401).json({ ok: false, error: errorMessage });
    }

    try {
      const payload = verifyToken(token);

      req.auth = req.auth || {};
      req.auth.payload = payload;

      if (attachToReqUser) {
        req.user = req.user || payload;
      }

      return next();
    } catch (e) {
      if (!required) {
        const devPayload = readDevIdentityFromHeaders(req);

        if (devPayload) {
          req.auth = req.auth || {};
          req.auth.payload = {
            ...(req.auth.payload || {}),
            ...devPayload,
          };

          if (attachToReqUser) {
            req.user = {
              ...(req.user || {}),
              ...req.auth.payload,
            };
          }
        }

        return next();
      }

      return res.status(401).json({
        ok: false,
        error: errorMessage,
        details: String(e?.message || e),
      });
    }
  };
}

export default makeAuthMw;
export { getBearer };