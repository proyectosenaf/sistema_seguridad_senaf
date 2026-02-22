import { auth as requireJwt } from "express-oauth2-jwt-bearer";
import jwt from "jsonwebtoken";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function getBearer(req) {
  const h = String(req.headers.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

function decodeJwtHeader(token) {
  try {
    const [h] = String(token).split(".");
    if (!h) return null;
    const json = Buffer.from(h, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function makeAuthMw() {
  const disableAuth = process.env.DISABLE_AUTH === "1";

  if (disableAuth) {
    console.warn("[AUTH] DISABLE_AUTH=1 → JWT deshabilitado");
    return (_req, _res, next) => next();
  }

  const hasAuth0 =
    !!process.env.AUTH0_AUDIENCE && !!process.env.AUTH0_ISSUER_BASE_URL;

  // ✅ En producción, si falta config de Auth0, NO se debe “abrir”
  if (!hasAuth0) {
    const msg =
      "[AUTH] Faltan AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL. En producción esto es configuración inválida.";
    if (isProd()) {
      console.error(msg);
      return (_req, res) => res.status(500).json({ ok: false, error: msg });
    }
    console.warn(
      "[AUTH] Faltan AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL → (DEV) JWT Auth0 deshabilitado"
    );
  } else {
    console.log("[AUTH] JWT Auth0 activo");
  }

  const auth0Mw = hasAuth0
    ? requireJwt({
        audience: process.env.AUTH0_AUDIENCE,
        issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
        tokenSigningAlg: "RS256",
      })
    : (_req, _res, next) => next(); // DEV sin Auth0

  // ✅ Middleware híbrido: acepta Auth0 (RS256) y JWT local (HS256)
  return (req, res, next) => {
    const token = getBearer(req);

    if (!token) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const hdr = decodeJwtHeader(token);
    const alg = hdr?.alg ? String(hdr.alg) : "";

    // 1) JWT local HS256
    if (alg.toUpperCase() === "HS256") {
      try {
        const payload = jwt.verify(
          token,
          process.env.JWT_SECRET || "dev_secret"
        );

        req.auth = req.auth || {};
        req.auth.payload = payload;

        return next();
      } catch {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    // 2) Auth0 RS256
    return auth0Mw(req, res, next);
  };
}