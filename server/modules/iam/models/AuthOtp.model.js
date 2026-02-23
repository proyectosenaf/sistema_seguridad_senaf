import mongoose from "mongoose";

const AuthOtpSchema = new mongoose.Schema(
  {
    email: { type: String, index: true, required: true },
    purpose: { type: String, enum: ["visitor-login", "employee-login"], index: true, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    meta: {
      userId: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// TTL: borrado automático al expirar
AuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("AuthOtp", AuthOtpSchema);