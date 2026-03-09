// server/modules/iam/models/IamUser.model.js
import mongoose from "mongoose";

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normRoles(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function normPerms(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

const IamUserSchema = new mongoose.Schema(
  {
    email: {
      type: String, 
      required: true,
      lowercase: true,
      trim: true,
      set: normEmail,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "")),
        message: "email_invalid",
      },
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

    provider: {
      type: String,
      enum: ["local", "external"],
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

    otpVerifiedAt: {
      type: Date,
      default: null,
      index: true,
    },

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

    roles: {
      type: [String],
      default: [],
      index: true,
      set: normRoles,
    },

    perms: {
      type: [String],
      default: [],
      set: normPerms,
    },

    externalId: {
      type: String,
      trim: true,
      default: null,
    },

    legacySub: {
      type: String,
      trim: true,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "iam_users",
  }
);

/* =========================
   Índices
========================= */

IamUserSchema.index({ email: 1 }, { unique: true });
IamUserSchema.index({ createdAt: -1 });
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });
IamUserSchema.index({ legacySub: 1 }, { unique: true, sparse: true });

/* =========================
   Export seguro
========================= */

const IamUser = mongoose.models.IamUser || mongoose.model("IamUser", IamUserSchema);

export default IamUser;