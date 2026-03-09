// server/modules/iam/models/IamRole.model.js
import mongoose from "mongoose";

function normPerms(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((p) => String(p || "").trim().toLowerCase()) // ✅ normaliza permisos
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function normName(v) {
  return String(v || "").trim(); // ✅ dejamos el casing visible tal cual, pero limpio
}

function normNameLower(v) {
  return String(v || "").trim().toLowerCase();
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
      set: normName, // ✅ consistente
    }, // ej: "Administrador"

    // ✅ para búsquedas case-insensitive estables (sin depender de collation)
    nameLower: {
      type: String,
      default: "",
      set: normNameLower,
    },

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
schema.index({ nameLower: 1 }); // ✅ índice único declarado una sola vez
schema.index({ permissions: 1 });

// normalización extra al guardar
schema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = normName(this.name);
    this.nameLower = normNameLower(this.name);
  } else if (!this.nameLower && this.name) {
    this.nameLower = normNameLower(this.name);
  }

  if (this.isModified("permissions")) {
    this.permissions = normPerms(this.permissions);
  }
  next();
});

// normalización en updates
schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  // code
  if (u?.code && typeof u.code === "string") {
    u.code = u.code.trim().toLowerCase();
  }
  if (u?.$set?.code && typeof u.$set.code === "string") {
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