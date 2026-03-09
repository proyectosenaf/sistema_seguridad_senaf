// server/modules/incidentes/models/incident.model.js
import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["photo", "video", "audio"],
      required: true,
    },
    url: { type: String, required: true },
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    reportedBy: { type: String, required: true, trim: true },
    zone: { type: String, required: true, trim: true },

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

    evidences: {
      type: [evidenceSchema],
      default: [],
    },

    date: { type: Date, default: Date.now },

    source: { type: String, default: "rondas", trim: true },
    rondaId: { type: mongoose.Schema.Types.ObjectId, ref: "RondaIncident", default: null },
  },
  { timestamps: true }
);

export default mongoose.models.IncidentGlobal ||
  mongoose.model("IncidentGlobal", incidentSchema);