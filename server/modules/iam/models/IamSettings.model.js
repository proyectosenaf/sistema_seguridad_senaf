import mongoose from "mongoose";

const IamSettingsSchema = new mongoose.Schema(
  {
    auth: {
      otpEnabled: { type: Boolean, default: true },
      otpLength: { type: Number, default: 6 },
      otpTtlSeconds: { type: Number, default: 600 }, // 10 min
      otpMaxAttempts: { type: Number, default: 5 },
      otpCooldownSeconds: { type: Number, default: 60 },
      channels: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
    },
    visitor: {
      enabled: { type: Boolean, default: true },
      requiresOtp: { type: Boolean, default: true },
      requiresPassword: { type: Boolean, default: false },
      role: { type: String, default: "visita" },
      redirect: { type: String, default: "/agenda-citas" },
    },
    employee: {
      enabled: { type: Boolean, default: true },
      requiresOtp: { type: Boolean, default: true },
      requiresPassword: { type: Boolean, default: true },
      requirePasswordResetIfExpired: { type: Boolean, default: true },
    },
    redirectsByRole: {
      type: Map,
      of: String,
      default: { visita: "/agenda-citas", admin: "/dashboard", guardia: "/rondas" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("IamSettings", IamSettingsSchema);