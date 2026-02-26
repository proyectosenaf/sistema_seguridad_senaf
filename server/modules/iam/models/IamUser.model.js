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
    },

    perms: {
      type: [String],
      default: [],
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

    passwordHash: {
      type: String,
      select: false,
      default: "",
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    passwordExpiresAt: {
      type: Date,
      default: null,
    },

    /* =========================
       CLAVE TEMPORAL (PRELOGIN)
    ========================= */

    tempPassHash: {
      type: String,
      select: false,
      default: "",
    },

    tempPassExpiresAt: {
      type: Date,
      default: null,
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

// Email único
IamUserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("IamUser", IamUserSchema);