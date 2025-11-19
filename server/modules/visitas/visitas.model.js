// server/src/modules/visitas/visita.model.js

import mongoose from "mongoose";

/* Subdocumento para el vehículo del visitante */
const VehiculoVisitanteSchema = new mongoose.Schema(
  {
    marca: { type: String, trim: true },
    modelo: { type: String, trim: true },
    placa: { type: String, trim: true },
  },
  { _id: false }
);

const VisitaSchema = new mongoose.Schema(
  {
    /* Datos base */
    nombre: { type: String, required: true, trim: true },
    documento: { type: String, required: true, trim: true },
    empresa: { type: String, default: null, trim: true },
    empleado: { type: String, default: null, trim: true },
    motivo: { type: String, required: true, trim: true },

    telefono: { type: String, default: null, trim: true },
    correo: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Correo no válido",
      },
    },

    /* Tipo y estado */
    tipo: {
      type: String,
      enum: ["Ingreso", "Agendada"],
      default: "Ingreso",
      index: true,
    },

    // 🔹 Aquí SOLO amplié la lista de estados permitidos
    // para poder usar en_revision / autorizada / denegada
    estado: {
      type: String,
      enum: [
        "Programada",
        "Dentro",
        "Finalizada",
        "Cancelada",
        "en_revision",
        "autorizada",
        "denegada",
      ],
      default: function () {
        return this.tipo === "Agendada" ? "Programada" : "Dentro";
      },
      index: true,
    },

    /* Vehículo del visitante */
    llegoEnVehiculo: { type: Boolean, default: false },
    vehiculo: { type: VehiculoVisitanteSchema, default: null },

    /* Fechas */
    citaAt: { type: Date, default: null, index: true },
    fechaEntrada: { type: Date, default: null, index: true },
    fechaSalida: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* Índices */
VisitaSchema.index({ tipo: 1, estado: 1, citaAt: 1 });
VisitaSchema.index({ estado: 1, fechaEntrada: -1 });
VisitaSchema.index({ createdAt: -1 });
// Opcionalmente puedes ayudar consultas por vehiculo:
VisitaSchema.index({ estado: 1, llegoEnVehiculo: 1 });

/* Hook: autollenar fechaEntrada solo para ingresos nuevos */
VisitaSchema.pre("save", function (next) {
  if (this.isNew && this.tipo === "Ingreso" && !this.fechaEntrada) {
    this.fechaEntrada = new Date();
  }
  next();
});

/* Modelo */
const Visita =
  mongoose.models.Visita || mongoose.model("Visita", VisitaSchema);

export default Visita;
