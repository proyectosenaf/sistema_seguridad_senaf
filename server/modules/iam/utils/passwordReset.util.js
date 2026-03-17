// server/modules/iam/utils/passwordReset.util.js
import crypto from "crypto";

export function isProd() {
  return process.env.NODE_ENV === "production";
}

export function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function makeResetToken(length = 6) {
  const L = Math.max(4, Math.min(10, Number(length) || 6));
  const min = 10 ** (L - 1);
  const max = 10 ** L - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export function hashResetToken(token) {
  const secret = process.env.RESET_SECRET || "dev_reset_secret";

  return crypto
    .createHmac("sha256", secret)
    .update(String(token || "").trim().toUpperCase())
    .digest("hex");
}

export function isExpired(value) {
  if (!value) return true;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return true;

  return d.getTime() <= Date.now();
}