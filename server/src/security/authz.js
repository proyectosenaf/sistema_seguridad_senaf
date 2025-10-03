// src/security/authz.js
import jwt from "jsonwebtoken";

/**
 * Extrae el JWT desde Authorization: Bearer <token>
 */
function extractToken(req) {
  const h = req.headers["authorization"];
  if (!h) return null;
  const parts = h.split(" ");
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return null;
}

/**
 * Verifica el JWT con Auth0
 * - Usa tu AUTH0_JWKS o SECRET para validar
 * - Aquí uso jwt.verify con secret simulado, pero
 *   en prod deberías usar jwks-rsa (rotación de claves).
 */
function verifyJwt(token) {
  const secret = process.env.AUTH0_CLIENT_SECRET || process.env.JWT_SECRET;
  const audience = process.env.VITE_AUTH0_AUDIENCE;
  const issuer = process.env.VITE_AUTH0_ISSUER;

  try {
    const decoded = jwt.verify(token, secret, {
      audience,
      issuer,
      algorithms: ["HS256", "RS256"],
    });
    return decoded;
  } catch (err) {
    console.error("[authz] verifyJwt error:", err.message);
    return null;
  }
}

/**
 * 🔒 requireAuth
 * Verifica que el request tenga JWT válido.
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  const decoded = verifyJwt(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Normaliza usuario
  req.user = {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    roles: decoded["https://senaf.example.com/roles"] || decoded.roles || [],
    scopes: decoded.scope ? decoded.scope.split(" ") : [],
    raw: decoded,
  };

  next();
}

/**
 * 🔒 requireRole("admin")
 * Permite acceso solo si el user tiene ese rol.
 */
export function requireRole(role) {
  return function (req, res, next) {
    if (!req.user?.roles?.includes(role)) {
      return res.status(403).json({ error: `Requires role: ${role}` });
    }
    next();
  };
}

/**
 * 🔒 requireAnyRole(["admin","supervisor"])
 */
export function requireAnyRole(roles) {
  return function (req, res, next) {
    const ok = req.user?.roles?.some((r) => roles.includes(r));
    if (!ok) {
      return res.status(403).json({ error: `Requires any role: ${roles.join(",")}` });
    }
    next();
  };
}

/**
 * 🔒 requireScope("rondas:read")
 */
export function requireScope(scope) {
  return function (req, res, next) {
    if (!req.user?.scopes?.includes(scope)) {
      return res.status(403).json({ error: `Requires scope: ${scope}` });
    }
    next();
  };
}

/**
 * Helpers para usar en controllers
 */
export function hasRole(req, role) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes(role);
}

export function hasScope(req, scope) {
  return Array.isArray(req.user?.scopes) && req.user.scopes.includes(scope);
}
