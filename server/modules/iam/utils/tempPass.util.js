import crypto from "crypto";

/**
 * Genera una clave temporal segura (base64url) con longitud len.
 * Ej: "m3Q1nZkP7aX2"
 */
export function generateTempPassword(len = 12) {
  return crypto.randomBytes(24).toString("base64url").slice(0, len);
}