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

export function getJwtSecret() {
  const s = String(process.env.JWT_SECRET || "").trim();
  if (!s && isProd()) {
    throw Object.assign(new Error("JWT_SECRET requerido en producción"), { status: 500 });
  }
  return s || "dev_secret";
}

export function signToken(payload, opts = {}) {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "8h",
    ...opts,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
}