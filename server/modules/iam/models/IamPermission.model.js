import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // 🔥 siempre en minúsculas
    },

    label: {
      type: String,
      required: true,
      trim: true, // ej: "Crear usuarios"
    },

    group: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // 🔥 para agrupar sin inconsistencias
    },

    order: {
      type: Number,
      default: 0, // orden relativo dentro del grupo
    },
  },
  {
    timestamps: true,
    collection: "iam_permissions", // 👌 nombre correcto
  }
);

/* -------------------------
   ÍNDICES
------------------------- */

// Orden dentro de cada grupo
schema.index({ group: 1, order: 1 });

// NO declaramos índice para "key":
// unique:true ya genera uno automáticamente ✔

/* -------------------------
   NORMALIZACIONES
------------------------- */

schema.pre("save", function (next) {
  if (this.isModified("key") && typeof this.key === "string") {
    this.key = this.key.trim().toLowerCase();
  }
  if (this.isModified("group") && typeof this.group === "string") {
    this.group = this.group.trim().toLowerCase();
  }
  next();
});

schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate();

  if (u?.key && typeof u.key === "string") {
    u.key = u.key.trim().toLowerCase();
  }

  if (u?.group && typeof u.group === "string") {
    u.group = u.group.trim().toLowerCase();
  }

  this.setUpdate(u);
  next();
});

export default mongoose.model("IamPermission", schema);
