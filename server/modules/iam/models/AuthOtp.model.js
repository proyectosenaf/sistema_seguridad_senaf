// server/modules/iam/models/AuthOtp.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

const AuthOtpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
      set: normEmail,
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
    codeHash: { type: String, required: true },

    // Fecha de expiración del OTP (TTL)
    expiresAt: { type: Date, required: true },

    // Estado explícito
    status: {
      type: String,
      enum: ["active", "consumed", "expired"],
      default: "active",
      index: true,
    },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },

    resendAfter: { type: Date, default: null, index: true },
    consumedAt: { type: Date, default: null, index: true },

    meta: {
      userId: { type: Schema.Types.ObjectId, ref: "iam_users", default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "authotps", // ✅ importante: coincide con tu error senafseg.authotps
  }
);

/* =========================
   ÍNDICES
========================= */

// TTL automático: elimina documento cuando expiresAt < now
AuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// búsquedas
AuthOtpSchema.index({ email: 1, purpose: 1, status: 1 });

// ✅ Solo 1 OTP ACTIVO por email+purpose (status === "active")
AuthOtpSchema.index(
  { email: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "uniq_active_email_purpose",
  }
);

/* =========================
   NORMALIZACIÓN EXTRA
========================= */

AuthOtpSchema.pre("save", function (next) {
  if (this.isModified("email")) this.email = normEmail(this.email);
  next();
});

AuthOtpSchema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  // Soporta update directo: { email: "..." }
  if (u.email) u.email = normEmail(u.email);

  // Soporta operadores: { $set: { email: "..." } }
  if (u.$set?.email) u.$set.email = normEmail(u.$set.email);

  // Soporta upsert insert: { $setOnInsert: { email: "..." } }
  if (u.$setOnInsert?.email) u.$setOnInsert.email = normEmail(u.$setOnInsert.email);

  this.setUpdate(u);
  next();
});

/* =========================
   MÉTODOS
========================= */

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

export default mongoose.models.AuthOtp || mongoose.model("AuthOtp", AuthOtpSchema);