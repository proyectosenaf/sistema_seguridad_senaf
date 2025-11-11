// server/modules/incidentes/models/incident.model.js
import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    reportedBy: { type: String, required: true },
    zone: { type: String, required: true },
    priority: {
      type: String,
      enum: ["baja", "media", "alta"],
      default: "media",
    },
    status: {
      type: String,
      enum: ["abierto", "en_proceso", "resuelto"],
      default: "abierto",
    },
    photos: [String],
    date: { type: Date, default: Date.now },
    source: { type: String, default: "rondas" }, // para saber si viene del módulo de rondas
    rondaId: { type: mongoose.Schema.Types.ObjectId, ref: "RondaIncident" },
  },
  { timestamps: true }
);

export default mongoose.model("IncidentGlobal", incidentSchema);
