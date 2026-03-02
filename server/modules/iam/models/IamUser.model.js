// server/modules/iam/models/IamUser.model.js
import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    /* =========================
       IDENTIDAD
    ========================= */
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      set: (v) => String(v || "").trim().toLowerCase(),
    },

    name: { type: String, trim: true, default: "" },

    active: { type: Boolean, default: true, index: true },

    /* =========================
       AUTENTICACIÓN
    ========================= */
    provider: {
      type: String,
      enum: ["local", "external"],
      default: "local",
      index: true,
    },

    passwordHash: { type: String, select: false, default: "" },

    mustChangePassword: { type: Boolean, default: false, index: true },

    passwordChangedAt: { type: Date, default: null },
    passwordExpiresAt: { type: Date, default: null, index: true },

    /* =========================
       OTP
    ========================= */
    otpVerifiedAt: { type: Date, default: null, index: true },

    /* =========================
       CLAVE TEMPORAL / RESET
    ========================= */
    tempPassHash: { type: String, select: false, default: "" },
    tempPassExpiresAt: { type: Date, default: null, index: true },
    tempPassUsedAt: { type: Date, default: null },
    tempPassAttempts: { type: Number, default: 0 },

    /* =========================
       RBAC
    ========================= */
    roles: {
      type: [String],
      default: [],
      index: true,
      set: (arr) =>
        Array.isArray(arr)
          ? arr.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
    },

    perms: {
      type: [String],
      default: [],
      set: (arr) =>
        Array.isArray(arr)
          ? arr.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
    },

    /* =========================
       LEGACY (solo si lo ocupas)
    ========================= */
    externalId: { type: String, trim: true, default: null },
    legacySub: { type: String, trim: true, default: null },

    /* =========================
       AUDITORÍA
    ========================= */
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "" },
  },
  { timestamps: true, collection: "iamusers" }
);

/* =========================
   ÍNDICES
========================= */
IamUserSchema.index({ email: 1 }, { unique: true });
IamUserSchema.index({ createdAt: -1 });

// únicos pero sparse (permiten nulls repetidos)
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });
IamUserSchema.index({ legacySub: 1 }, { unique: true, sparse: true });

export default mongoose.models.IamUser || mongoose.model("IamUser", IamUserSchema);