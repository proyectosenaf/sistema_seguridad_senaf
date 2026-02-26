// server/src/middleware/auth.js
import jwt from "jsonwebtoken";
import { env } from "../config/env.js"; // opcional; si no lo necesitas, elimínalo

const IS_PROD = process.env.NODE_ENV === "production";
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";

function getBearer(req) {
  const h = String(req?.headers?.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

function verifyLocalJwt(token) {
  const secret = process.env.JWT_SECRET || env?.jwtSecret || "dev_secret";
  return jwt.verify(token, secret, { algorithms: ["HS256"] });
}

/**
 * requireAuth (HS256):
 * - DISABLE_AUTH=1 => passthrough (dev)
 * - Requiere Authorization: Bearer <token>
 * - Adjunta req.auth.payload y req.user mínimo
 */
export const requireAuth = DISABLE_AUTH
  ? (_req, _res, next) => next()
  : (req, res, next) => {
      const token = getBearer(req);
      if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

      try {
        const payload = verifyLocalJwt(token);

        req.auth = req.auth || {};
        req.auth.payload = payload;

        // Usuario mínimo (roles/perms NO aquí)
        req.user = {
          sub: payload.sub || payload._id || null,
          email: payload.email ? String(payload.email).toLowerCase().trim() : null,
          name: payload.name || null,
        };

        return next();
      } catch {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    };

// alias útil
export { requireAuth as checkJwt };

/**
 * optionalAuth:
 * - Si NO hay Bearer => pasa (visitor)
 * - Si hay Bearer => valida
 */
export function optionalAuth(req, res, next) {
  if (DISABLE_AUTH) return next();
  const token = getBearer(req);
  if (!token) return next();
  return requireAuth(req, res, next);
}

/**
 * attachAuthUser:
 * - Si ya hay req.auth.payload (porque requireAuth corrió) deja req.user listo
 * - No parsea roles/perms
 */
export function attachAuthUser(req, _res, next) {
  const p = req?.auth?.payload;
  if (p && !req.user) {
    req.user = {
      sub: p.sub || p._id || null,
      email: p.email ? String(p.email).toLowerCase().trim() : null,
      name: p.name || null,
    };
  }
  next();
}

/**
 * requireAdmin:
 * - En tu nueva arquitectura, esto debería ser requirePerm("admin") o similar.
 * - Aquí lo dejamos por compatibilidad:
 *   1) si existe req.iam => usa roles/perms resueltos centralmente
 *   2) fallback: bloquea (porque req.user ya no trae roles/perms)
 */
export function requireAdmin(req, res, next) {
  const DEV_OPEN = String(process.env.DEV_OPEN || "0") === "1";
  if (!IS_PROD && (DISABLE_AUTH || DEV_OPEN)) return next();

  // ✅ Preferido: IAM centralizado
  if (req.iam) {
    const roles = (req.iam.roles || []).map((r) => String(r).toLowerCase());
    const perms = Array.isArray(req.iam.permissions) ? req.iam.permissions : [];
    if (roles.includes("admin") || perms.includes("*")) return next();

    return res.status(403).json({
      ok: false,
      message: "Acceso solo para administradores",
      roles,
      perms,
    });
  }

  // Fallback estricto (para no abrir huecos)
  return res.status(403).json({
    ok: false,
    message:
      "Admin guard requiere req.iam (IAM centralizado). Ajusta la ruta a usar requirePerm(...) o attach IAM context.",
  });
}