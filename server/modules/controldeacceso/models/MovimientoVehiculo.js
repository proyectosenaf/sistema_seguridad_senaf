// server/modules/acceso/models/MovimientoVehiculo.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const MovimientoVehiculoSchema = new Schema(
  {
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo", required: true },

    // empleado dueño del vehículo (para empleados; para visitantes puedes dejarlo null)
    empleado: { type: Schema.Types.ObjectId, ref: "Empleado", default: null },

    tipo: {
      type: String,
      enum: ["TOGGLE", "ENTRADA", "SALIDA", "AJUSTE"],
      default: "TOGGLE",
    },

    estadoEnEmpresa: { type: Boolean, default: true },

    observacion: { type: String, trim: true, default: "" },
    usuarioGuardia: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("MovimientoVehiculo", MovimientoVehiculoSchema);
