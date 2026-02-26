// server/modules/iam/utils/auth.util.js
import jwt from "jsonwebtoken";

export function getBearer(req) {
  const h = String(req.headers.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

export function getJwtSecret() {
  return String(process.env.JWT_SECRET || "dev_secret").trim() || "dev_secret";
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
}

export function signToken(payload, options = {}) {
  return jwt.sign(payload, getJwtSecret(), options);
}

export function makeAuthMw() {
  const disableAuth = process.env.DISABLE_AUTH === "1";

  if (disableAuth) {
    console.warn("[AUTH] DISABLE_AUTH=1 → JWT deshabilitado");
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
      const payload = verifyToken(token);

      req.auth = req.auth || {};
      req.auth.payload = payload;

      // compat opcional
      req.user = req.user || payload;

      return next();
    } catch {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  };
}

// ✅ compat si en algún lado hacen `import makeAuthMw from ...`
export default makeAuthMw;