// server/modules/iam/models/IamRole.model.js
import mongoose from "mongoose";

function normPerms(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
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
    }, // ej: "admin"

    name: {
      type: String,
      required: true,
      trim: true,
    }, // ej: "Administrador"

    description: { type: String, trim: true },

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
schema.index({ name: 1 });
schema.index({ permissions: 1 });

// normalización extra al guardar
schema.pre("save", function (next) {
  if (this.isModified("permissions")) {
    this.permissions = normPerms(this.permissions);
  }
  next();
});

// normalización en updates
schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  if (u?.code && typeof u.code === "string") {
    u.code = u.code.trim().toLowerCase();
  }

  if (u?.permissions) {
    u.permissions = normPerms(u.permissions);
  }

  if (u?.$set?.permissions) {
    u.$set.permissions = normPerms(u.$set.permissions);
  }

  this.setUpdate(u);
  next();
});

export default mongoose.models.IamRole || mongoose.model("IamRole", schema);