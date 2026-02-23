// server/modules/iam/services/settings.service.js
// Centraliza settings para IAM/Public Auth (OTP, expiraciones, etc.)

function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function getSecuritySettings() {
  return {
    // OTP (visitantes / empleados)
    otp: {
      ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 300), // 5 min
      maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
      resendCooldownSeconds: toInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
    },

    // Password policy (empleados creados por admin)
    password: {
      expiresDays: toInt(process.env.PASSWORD_EXPIRES_DAYS, 0), // 0 = no vence por días (solo mustChangePassword)
      minLength: toInt(process.env.PASSWORD_MIN_LENGTH, 8),
    },

    // Feature flags
    features: {
      enablePublicOtp: String(process.env.FEATURE_PUBLIC_OTP || "1") === "1",
      enableEmployeeOtp: String(process.env.FEATURE_EMPLOYEE_OTP || "1") === "1",
    },
  };
}