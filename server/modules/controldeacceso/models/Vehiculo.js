import mongoose from "mongoose";

const { Schema } = mongoose;

const VehiculoSchema = new Schema(
  {
    empleado: {
      type: Schema.Types.ObjectId,
      ref: "Empleado",
      required: true,
      index: true,
    },

    marca: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    modelo: {
      type: String,
      trim: true,
      default: "",
    },

    placa: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    enEmpresa: {
      type: Boolean,
      default: true,
      index: true,
    },

    activo: {
      type: Boolean,
      default: true,
      index: true,
    },

    ultimoMovimiento: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ───────────────────── Normalización ───────────────────── */

VehiculoSchema.pre("save", function normalizeBeforeSave(next) {
  if (typeof this.marca === "string") {
    this.marca = this.marca.trim();
  }

  if (typeof this.modelo === "string") {
    this.modelo = this.modelo.trim();
  }

  if (typeof this.placa === "string") {
    this.placa = this.placa.trim().toUpperCase();
  }

  next();
});

/* ───────────────────── Índice único placa ───────────────────── */

VehiculoSchema.index({ placa: 1 }, { unique: true });

export default mongoose.models.Vehiculo ||
  mongoose.model("Vehiculo", VehiculoSchema);