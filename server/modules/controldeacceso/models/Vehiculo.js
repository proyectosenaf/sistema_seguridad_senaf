// server/modules/acceso/models/Vehiculo.js
import mongoose from "mongoose";

const VehiculoSchema = new mongoose.Schema(
  {
    empleado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Empleado",
      required: true,
    },
    marca: { type: String, default: "" },
    modelo: { type: String, default: "" },
    placa: { type: String, required: true, unique: true, index: true },
    enEmpresa: { type: Boolean, default: true }, // estado del estacionamiento
    activo: { type: Boolean, default: true },
    ultimoMovimiento: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Vehiculo", VehiculoSchema);
