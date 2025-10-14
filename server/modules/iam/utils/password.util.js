// ESM module
import bcrypt from "bcryptjs";

/**
 * Hashea una contraseña con bcrypt (cost=10).
 * Devuelve un string con el hash.
 */
export async function hashPassword(pwd) {
  const plain = String(pwd ?? "");
  if (!plain) throw new Error("password vacío");
  const saltRounds = 10;
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
