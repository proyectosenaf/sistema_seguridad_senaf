import mongoose from "mongoose";

const { Schema } = mongoose;

const MovimientoVehiculoSchema = new Schema(
  {
    vehiculo: {
      type: Schema.Types.ObjectId,
      ref: "Vehiculo",
      required: true,
      index: true,
    },

    // dueño del vehículo (si aplica)
    empleado: {
      type: Schema.Types.ObjectId,
      ref: "Empleado",
      default: null,
      index: true,
    },

    tipo: {
      type: String,
      enum: ["TOGGLE", "ENTRADA", "SALIDA", "AJUSTE"],
      default: "TOGGLE",
      trim: true,
      index: true,
    },

    estadoEnEmpresa: {
      type: Boolean,
      default: true,
      index: true,
    },

    observacion: {
      type: String,
      trim: true,
      default: "",
    },

    usuarioGuardia: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ───────────────────── Normalización ───────────────────── */

MovimientoVehiculoSchema.pre("save", function normalizeBeforeSave(next) {
  if (typeof this.observacion === "string") {
    this.observacion = this.observacion.trim();
  }

  if (typeof this.usuarioGuardia === "string") {
    this.usuarioGuardia = this.usuarioGuardia.trim();
  }

  next();
});

export default mongoose.models.MovimientoVehiculo ||
  mongoose.model("MovimientoVehiculo", MovimientoVehiculoSchema);