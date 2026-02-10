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

    // Evidencias guardadas como URL relativas en /uploads/incidentes/*
    photos: { type: [String], default: [] },
    videos: { type: [String], default: [] }, // ✅ NUEVO
    audios: { type: [String], default: [] }, // ✅ NUEVO

    date: { type: Date, default: Date.now },

    // metadata
    source: { type: String, default: "rondas" },
    rondaId: { type: mongoose.Schema.Types.ObjectId, ref: "RondaIncident" },
  },
  { timestamps: true }
);

export default mongoose.models.IncidentGlobal ||
  mongoose.model("IncidentGlobal", incidentSchema);
