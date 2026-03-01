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
      enum: ["local"], // si luego metes auth0, aquí lo amplías
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

IamUserSchema.index({ email: 1 }, { unique: true });
IamUserSchema.index({ createdAt: -1 }); // útil para listados recientes

export default mongoose.model("IamUser", IamUserSchema);