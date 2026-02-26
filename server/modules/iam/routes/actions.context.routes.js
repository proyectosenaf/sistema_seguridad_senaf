import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    /* =========================================================
       IDENTIDAD
    ========================================================= */

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    /* =========================================================
       AUTENTICACIÓN
    ========================================================= */

    provider: {
      type: String,
      enum: ["local", "external"],
      default: "local", // ✅ ahora SENAF es el proveedor principal
      index: true,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    passwordChangedAt: {
      type: Date,
    },

    passwordExpiresAt: {
      type: Date,
    },

    /* =========================================================
       CLAVE TEMPORAL (PRELOGIN)
    ========================================================= */

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

    /* =========================================================
       RBAC
    ========================================================= */

    roles: {
      type: [String],
      default: [],
      index: true,
    },

    perms: {
      type: [String],
      default: [],
    },

    /* =========================================================
       CAMPOS LEGACY (opcional, no obligatorios)
       Mantener solo si necesitas migraciones antiguas
    ========================================================= */

    externalId: {
      type: String,
      trim: true,
      sparse: true,
    },

    legacySub: {
      type: String,
      trim: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    collection: "iamusers",
  }
);

/* =========================================================
   ÍNDICES
========================================================= */

// Email único
IamUserSchema.index({ email: 1 }, { unique: true });

// externalId único (si se usa)
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });

// legacySub opcional
IamUserSchema.index({ legacySub: 1 }, { unique: true, sparse: true });

export default mongoose.model("IamUser", IamUserSchema);