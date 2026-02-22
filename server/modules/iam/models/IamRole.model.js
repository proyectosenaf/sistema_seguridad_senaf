// server/modules/iam/models/IamRole.model.js
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true, // índice único
      trim: true,
      lowercase: true, // siempre en minúsculas
    }, // ej: "admin"
    name: {
      type: String,
      required: true,
      trim: true,
    }, // ej: "Administrador"
    description: { type: String, trim: true },

    // Guardamos KEYS de permisos (p.ej. "incidentes.read")
    permissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "iam_roles",
  }
);

// Índices útiles
schema.index({ name: 1 });
schema.index({ permissions: 1 });

function normPerms(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

// Normaliza 'code' y permissions al guardar/actualizar
schema.pre("save", function (next) {
  if (this.isModified("code") && typeof this.code === "string") {
    this.code = this.code.trim().toLowerCase();
  }
  if (this.isModified("permissions")) {
    this.permissions = normPerms(this.permissions);
  }
  next();
});

schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  if (u?.code && typeof u.code === "string") {
    u.code = u.code.trim().toLowerCase();
  }

  // soporta $set.permissions o permissions directo
  if (u?.permissions) {
    u.permissions = normPerms(u.permissions);
  }
  if (u?.$set?.permissions) {
    u.$set.permissions = normPerms(u.$set.permissions);
  }

  this.setUpdate(u);
  next();
});

export default mongoose.model("IamRole", schema);