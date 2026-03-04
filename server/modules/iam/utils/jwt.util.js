// server/modules/iam/utils/jwt.util.js
import jwt from "jsonwebtoken";

export function getBearer(req) {
  const h = String(req?.headers?.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

function isProd() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function envStr(name) {
  const v = String(process.env[name] || "").trim();
  return v || null;
}

function getJwtExpiresIn() {
  // Respeta env si existe (tu auth.otp.routes.js usa JWT_EXPIRES_IN también)
  return envStr("JWT_EXPIRES_IN") || "12h";
}

export function getJwtSecret() {
  const s = envStr("JWT_SECRET");
  if (!s && isProd()) {
    throw Object.assign(new Error("JWT_SECRET requerido en producción"), { status: 500 });
  }
  return s || "dev_secret";
}

export function signToken(payload, opts = {}) {
  const base = {
    algorithm: "HS256",
    expiresIn: getJwtExpiresIn(),
  };

  // si opts trae expiresIn o algorithm, los respeta
  return jwt.sign(payload, getJwtSecret(), { ...base, ...opts });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
}