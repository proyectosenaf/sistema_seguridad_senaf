// server/modules/iam/utils/password.util.js
import bcrypt from "bcryptjs";

/**
 * Hashea una contraseña con bcrypt.
 * Cost configurable por env: BCRYPT_ROUNDS (default 10).
 */
export async function hashPassword(pwd) {
  const plain = String(pwd ?? "").trim();
  if (!plain) throw new Error("password vacío");
  const saltRounds = Number(process.env.BCRYPT_ROUNDS || 10);
  return bcrypt.hash(plain, saltRounds);
}

/**
 * Verifica una contraseña contra un hash bcrypt.
 * Devuelve true/false.
 */
export async function verifyPassword(pwd, hash) {
  const plain = String(pwd ?? "");
  const h = String(hash ?? "");
  if (!plain || !h) return false;
  return bcrypt.compare(plain, h);
}