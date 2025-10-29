const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },          // Ej: "Acceso no autorizado"
    description: { type: String, required: true },   // Detalle del incidente
    reportedBy: { type: String, required: true },    // Quién reporta
    zone: { type: String, required: true },          // Dónde pasó
    priority: {
      type: String,
      enum: ["baja", "media", "alta"],
      default: "media",
      required: true,
    },
    status: {
      type: String,
      enum: ["abierto", "en_proceso", "resuelto"],
      default: "abierto",
      required: true,
    },
    date: { type: Date, default: Date.now },         // Momento del incidente
  },
  { timestamps: true } // createdAt / updatedAt
);

const Incident = mongoose.model("Incident", IncidentSchema);
module.exports = Incident;
