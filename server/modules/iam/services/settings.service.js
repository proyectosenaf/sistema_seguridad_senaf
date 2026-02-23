// server/modules/iam/services/settings.service.js
// Centraliza configuración (parametrizable por .env)

function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toBool(v, def = false) {
  if (v === undefined || v === null) return !!def;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return !!def;
}

export function getIamSettings() {
  return {
    otp: {
      ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 300),
      maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
      resendCooldownSeconds: toInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
    },
    password: {
      expiresDays: toInt(process.env.PASSWORD_EXPIRES_DAYS, 0),
      minLength: toInt(process.env.PASSWORD_MIN_LENGTH, 8),
    },
    features: {
      enableEmployeeOtp: toBool(process.env.FEATURE_EMPLOYEE_OTP, true),
      enablePublicOtp: toBool(process.env.FEATURE_PUBLIC_OTP, true),
    },
  };
}

// ✅ Alias compatibilidad (por si en otras partes ya llamabas esto)
export const getSecuritySettings = getIamSettings;