// server/modules/iam/models/AuthOtp.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const AuthOtpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /**
     * purpose:
     * - visitor-login: OTP para visitantes
     * - employee-login: OTP para usuarios internos (empleados/admin)
     */
    purpose: {
      type: String,
      enum: ["visitor-login", "employee-login"],
      required: true,
      index: true,
    },

    // Hash del código OTP
    codeHash: {
      type: String,
      required: true,
    },

    // Fecha de expiración del OTP (TTL)
    expiresAt: {
      type: Date,
      required: true,
    },

    // Estado explícito (evita depender de TTL para permitir re-emitir)
    status: {
      type: String,
      enum: ["active", "consumed", "expired"],
      default: "active",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },

    resendAfter: {
      type: Date,
      default: null,
      index: true,
    },

    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },

    meta: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "IamUser",
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =========================================================
   Índices
========================================================= */

// TTL automático: elimina documento cuando expiresAt < now
AuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Índice compuesto para búsquedas rápidas
AuthOtpSchema.index({ email: 1, purpose: 1, status: 1 });

// 🔒 Solo 1 OTP ACTIVO por email + purpose (status === "active")
AuthOtpSchema.index(
  { email: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);

/* =========================================================
   Métodos útiles
========================================================= */

AuthOtpSchema.methods.markConsumed = function () {
  this.consumedAt = new Date();
  this.status = "consumed";
  return this.save();
};

AuthOtpSchema.methods.markExpired = function () {
  this.status = "expired";
  return this.save();
};

AuthOtpSchema.methods.isExpired = function () {
  return !this.expiresAt || new Date() > this.expiresAt;
};

export default mongoose.model("AuthOtp", AuthOtpSchema);