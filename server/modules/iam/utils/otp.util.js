import crypto from "crypto";

export function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

export function makeOtp(length = 6) {
  const L = Math.max(4, Math.min(10, Number(length) || 6));
  const min = 10 ** (L - 1);
  const max = 10 ** L - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export function hashOtp(email, code) {
  const secret = process.env.OTP_SECRET || "dev_otp_secret";
  return crypto.createHmac("sha256", secret).update(`${normEmail(email)}:${String(code)}`).digest("hex");
}