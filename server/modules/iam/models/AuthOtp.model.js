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

    purpose: {
      type: String,
      enum: ["visitor-login", "employee-login"],
      required: true,
      index: true,
    },

    codeHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
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
AuthOtpSchema.index({ email: 1, purpose: 1, consumedAt: 1 });

// 🔒 Solo 1 OTP ACTIVO por email + purpose
// (parcial: solo cuando consumedAt === null)
AuthOtpSchema.index(
  { email: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: { consumedAt: null },
  }
);

/* =========================================================
   Métodos útiles
========================================================= */

// Marca OTP como consumido
AuthOtpSchema.methods.consume = function () {
  this.consumedAt = new Date();
  return this.save();
};

// Verifica expiración
AuthOtpSchema.methods.isExpired = function () {
  return !this.expiresAt || new Date() > this.expiresAt;
};

export default mongoose.model("AuthOtp", AuthOtpSchema);