// server/modules/iam/models/IamRole.model.js
import mongoose from "mongoose";

function normPerms(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((p) => String(p || "").trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function normName(v) {
  return String(v || "").trim();
}

function normNameLower(v) {
  return String(v || "").trim().toLowerCase();
}

function normDescription(v) {
  if (v == null) return "";
  return String(v).trim();
}

const schema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      set: (v) => String(v || "").trim().toLowerCase(),
    },

    name: {
      type: String,
      required: true,
      trim: true,
      set: normName,
    },

    nameLower: {
      type: String,
      default: "",
      set: normNameLower,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      set: normDescription,
    },

    permissions: {
      type: [String],
      default: [],
      set: normPerms,
    },
  },
  {
    timestamps: true,
    collection: "iam_roles",
  }
);

// índices
schema.index({ code: 1 }, { unique: true });
schema.index({ name: 1 });
schema.index({ nameLower: 1 });
schema.index({ permissions: 1 });

// normalización extra al guardar
schema.pre("save", function (next) {
  this.code = String(this.code || "").trim().toLowerCase();
  this.name = normName(this.name);
  this.nameLower = normNameLower(this.name);
  this.description = normDescription(this.description);
  this.permissions = normPerms(this.permissions);
  next();
});

// normalización en updates
schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  // code
  if (typeof u?.code === "string") {
    u.code = u.code.trim().toLowerCase();
  }
  if (typeof u?.$set?.code === "string") {
    u.$set.code = u.$set.code.trim().toLowerCase();
  }

  // name -> nameLower
  const hasDirectName = typeof u?.name === "string";
  const hasSetName = typeof u?.$set?.name === "string";
  const name = hasDirectName ? u.name : hasSetName ? u.$set.name : null;

  if (name != null) {
    const clean = normName(name);

    if (hasDirectName) u.name = clean;

    u.$set = u.$set || {};
    if (hasSetName) u.$set.name = clean;
    u.$set.nameLower = normNameLower(clean);
  }

  // description
  if (u?.description !== undefined) {
    u.description = normDescription(u.description);
  }
  if (u?.$set?.description !== undefined) {
    u.$set.description = normDescription(u.$set.description);
  }

  // permissions
  if (Array.isArray(u?.permissions)) {
    u.permissions = normPerms(u.permissions);
  }
  if (Array.isArray(u?.$set?.permissions)) {
    u.$set.permissions = normPerms(u.$set.permissions);
  }

  this.setUpdate(u);
  next();
});

export default mongoose.models.IamRole || mongoose.model("IamRole", schema);