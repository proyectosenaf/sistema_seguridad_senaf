// src/middleware/rateLimiter.js
import rateLimit from "express-rate-limit";

/**
 * Si estás detrás de proxy (Nginx/Cloudflare/ELB), en server.js añade:
 *   app.set('trust proxy', 1)
 * para que req.ip sea la IP real del cliente.
 */

const isProd   = process.env.NODE_ENV === "production";
const disabled = process.env.DISABLE_RATE_LIMIT === "1";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000); // 15 min
const max      = Number(process.env.RATE_LIMIT_MAX ?? (isProd ? 300 : 1000));

/** JSON handler cuando se alcanza el límite */
function handler(req, res /*, next, options */) {
  res.status(429).json({
    error: "Too many requests",
    detail: "Rate limit exceeded. Try again later.",
  });
}

/** Rutas a omitir + permitir desactivar en dev */
function skip(req /*, res */) {
  if (disabled) return true;                  // DISABLE_RATE_LIMIT=1
  if (req.path === "/api/health") return true;
  if (req.path === "/health") return true;    // por si tu monitor pega aquí
  return false;
}

/** Limitador general para /api */
export const apiLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip,
  handler,
});

/** (Opcional) limitador más estricto para auth/login */
export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60 * 1000),
  max:      Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip,
  handler,
});
