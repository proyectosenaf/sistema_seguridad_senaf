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

    name: {
      type: String,
      trim: true,
      default: "",
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

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
       AUTENTICACIÓN LOCAL
    ========================= */

    provider: {
      type: String,
      enum: ["local"],
      default: "local",
      index: true,
    },

    // ✅ OJO: select:false => debes usar .select("+passwordHash") para leerlo
    passwordHash: {
      type: String,
      select: false,
      default: "",
    },

    // ✅ Solo para usuarios internos creados por admin (no visitantes)
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    passwordExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    /* =========================
       OTP (PRIMER LOGIN)
    ========================= */
    otpVerifiedAt: {
      type: Date,
      default: null,
      index: true,
    },

    /* =========================
       CLAVE TEMPORAL (RESET)
    ========================= */

    tempPassHash: {
      type: String,
      select: false,
      default: "",
    },

    tempPassExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    tempPassUsedAt: {
      type: Date,
      default: null,
    },

    tempPassAttempts: {
      type: Number,
      default: 0,
    },

    /* =========================
       AUDITORÍA
    ========================= */

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "iamusers",
  }
);

/* =========================
   ÍNDICES
========================= */
IamUserSchema.index({ email: 1 }, { unique: true });
IamUserSchema.index({ createdAt: -1 });

export default mongoose.model("IamUser", IamUserSchema);