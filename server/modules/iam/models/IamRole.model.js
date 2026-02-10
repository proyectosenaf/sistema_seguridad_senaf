import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,           // índice único
      trim: true,
      lowercase: true,        // siempre en minúsculas
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

// Normaliza 'code' al guardar/actualizar
schema.pre("save", function (next) {
  if (this.isModified("code") && typeof this.code === "string") {
    this.code = this.code.trim().toLowerCase();
  }
  next();
});

schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate();
  if (u?.code && typeof u.code === "string") {
    u.code = u.code.trim().toLowerCase();
    this.setUpdate(u);
  }
  next();
});

export default mongoose.model("IamRole", schema);
