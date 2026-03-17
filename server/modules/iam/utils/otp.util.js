// server/modules/iam/utils/otp.util.js
import crypto from "crypto";

export function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

export function makeOtp(length = 6) {
  const L = Math.max(4, Math.min(10, Number(length) || 6));
  const min = 10 ** (L - 1);
  const max = 10 ** L;
  return String(crypto.randomInt(min, max));
}

export function hashOtp(email, code) {
  const secret = process.env.OTP_SECRET || "dev_otp_secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${normEmail(email)}:${String(code)}`)
    .digest("hex");
}