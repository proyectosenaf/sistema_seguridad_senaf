import mongoose from "mongoose";

const visitaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    documento: { type: String, required: true },
    empresa: { type: String, default: "-" },
    empleado: { type: String, default: "-" }, // a quién visita
    motivo: { type: String, required: true },

    telefono: { type: String },
    correo: { type: String },

    fechaEntrada: { type: Date, default: Date.now },
    fechaSalida: { type: Date },

    estado: {
      type: String,
      enum: ["Dentro", "Finalizada"],
      default: "Dentro",
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

const Visita = mongoose.model("Visita", visitaSchema);

export default Visita;
