// server/modules/rondasqr/models/incident.model.js
import mongoose from "mongoose";

const IncidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true }, // Ej: "Acceso no autorizado"
    description: { type: String, required: true, trim: true }, // Detalle del incidente
    reportedBy: { type: String, required: true, trim: true }, // Quién reporta
    zone: { type: String, required: true, trim: true }, // Dónde pasó
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
    photos: [{ type: String }], // rutas /uploads/incidentes/...
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// índice para listar rápido por fecha (GET /incidentes)
IncidentSchema.index({ createdAt: -1 });

// previene error de modelo redefinido en hot reload
const Incident =
  mongoose.models.Incident || mongoose.model("Incident", IncidentSchema);

export default Incident;
