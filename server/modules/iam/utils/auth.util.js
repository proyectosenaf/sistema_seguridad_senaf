import IamSession from "../models/IamSession.model.js";
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

function normalizeSubToUserId(sub) {
  const raw = String(sub || "").trim();
  if (!raw) return "";
  return raw.startsWith("local|") ? raw.slice(6) : raw;
}

async function validateActiveSessionFromPayload(payload) {
  const sessionId = String(payload?.sid || "").trim();
  const userId = normalizeSubToUserId(payload?.sub);

  if (!sessionId || !userId) {
    return {
      ok: false,
      error: "invalid_session",
      details: "Token sin sid o sub válido",
    };
  }

  const session = await IamSession.findOne({
    userId,
    sessionId,
    isActive: true,
  }).lean();

  if (!session) {
    return {
      ok: false,
      error: "session_invalidated",
      details: "La sesión ya no está activa",
    };
  }

  await IamSession.updateOne(
    { _id: session._id },
    { $set: { lastActivityAt: new Date() } }
  ).catch(() => {});

  return { ok: true, session };
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

  return async (req, res, next) => {
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

      const sessionCheck = await validateActiveSessionFromPayload(payload);
      if (!sessionCheck.ok) {
        return res.status(401).json({
          ok: false,
          error: sessionCheck.error,
          details: sessionCheck.details,
          message:
            sessionCheck.error === "session_invalidated"
              ? "Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo."
              : errorMessage,
        });
      }

      req.auth = req.auth || {};
      req.auth.payload = payload;
      req.auth.session = sessionCheck.session;

      if (attachToReqUser) {
        req.user = req.user || payload;
      }

      req.session = sessionCheck.session;
      req.sessionId = sessionCheck.session?.sessionId || payload?.sid || "";

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