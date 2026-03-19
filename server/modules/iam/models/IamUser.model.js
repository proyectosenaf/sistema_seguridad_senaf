// server/modules/iam/models/IamUser.model.js
import mongoose from "mongoose";

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normName(v) {
  return String(v || "").trim();
}

function normRoles(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => String(x || "").trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function normPerms(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function normStringOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
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
      set: normName,
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

    /* ───────── RESET PASSWORD ───────── */

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

    /* ───────── RBAC ───────── */

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

    /* ───────── Identidades externas ───────── */

    externalId: {
      type: String,
      trim: true,
      default: null,
      set: normStringOrNull,
    },

    legacySub: {
      type: String,
      trim: true,
      default: null,
      set: normStringOrNull,
    },

    /* ───────── Auditoría ───────── */

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

/* ───────── Índices ───────── */

IamUserSchema.index({ email: 1 }, { unique: true });
IamUserSchema.index({ createdAt: -1 });
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });
IamUserSchema.index({ legacySub: 1 }, { unique: true, sparse: true });
IamUserSchema.index({ tempPassExpiresAt: 1 });

/* ───────── Normalización extra ───────── */

IamUserSchema.pre("save", function (next) {
  this.email = normEmail(this.email);
  this.name = normName(this.name);
  this.roles = normRoles(this.roles);
  this.perms = normPerms(this.perms);
  this.externalId = normStringOrNull(this.externalId);
  this.legacySub = normStringOrNull(this.legacySub);
  next();
});

IamUserSchema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  if (typeof u?.email === "string") {
    u.email = normEmail(u.email);
  }
  if (typeof u?.$set?.email === "string") {
    u.$set.email = normEmail(u.$set.email);
  }

  if (typeof u?.name === "string") {
    u.name = normName(u.name);
  }
  if (typeof u?.$set?.name === "string") {
    u.$set.name = normName(u.$set.name);
  }

  if (Array.isArray(u?.roles)) {
    u.roles = normRoles(u.roles);
  }
  if (Array.isArray(u?.$set?.roles)) {
    u.$set.roles = normRoles(u.$set.roles);
  }

  if (Array.isArray(u?.perms)) {
    u.perms = normPerms(u.perms);
  }
  if (Array.isArray(u?.$set?.perms)) {
    u.$set.perms = normPerms(u.$set.perms);
  }

  if (u?.externalId !== undefined) {
    u.externalId = normStringOrNull(u.externalId);
  }
  if (u?.$set?.externalId !== undefined) {
    u.$set.externalId = normStringOrNull(u.$set.externalId);
  }

  if (u?.legacySub !== undefined) {
    u.legacySub = normStringOrNull(u.legacySub);
  }
  if (u?.$set?.legacySub !== undefined) {
    u.$set.legacySub = normStringOrNull(u.$set.legacySub);
  }

  this.setUpdate(u);
  next();
});

/* ───────── Export seguro ───────── */

const IamUser =
  mongoose.models.IamUser || mongoose.model("IamUser", IamUserSchema);

export default IamUser;