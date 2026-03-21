import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["photo", "video", "audio"],
      required: true,
    },
    url: { type: String, required: false, default: "" },
    base64: { type: String, required: false, default: "" },
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

    /* Texto visible */
    reportedBy: { type: String, required: true, trim: true },

    /* Identidad real del guardia / usuario */
    reportedByGuardId: { type: String, default: "", trim: true, index: true },
    reportedByGuardName: { type: String, default: "", trim: true },
    reportedByGuardEmail: { type: String, default: "", trim: true, lowercase: true },

    /* Compatibilidad con payload legado */
    guardId: { type: String, default: "", trim: true, index: true },
    guardName: { type: String, default: "", trim: true },
    guardEmail: { type: String, default: "", trim: true, lowercase: true },

    /* Usuario autenticado que creó realmente el incidente */
    createdByUserId: { type: String, default: "", trim: true, index: true },
    reportedByUserId: { type: String, default: "", trim: true },

    zone: { type: String, required: true, trim: true },

    priority: {
      type: String,
      enum: ["baja", "media", "alta"],
      default: "media",
      index: true,
    },

    status: {
      type: String,
      enum: ["abierto", "en_proceso", "resuelto"],
      default: "abierto",
      index: true,
    },

    evidences: {
      type: [evidenceSchema],
      default: [],
    },

    /* Compatibilidad hacia atrás */
    photosBase64: { type: [String], default: [] },
    videosBase64: { type: [String], default: [] },
    audiosBase64: { type: [String], default: [] },

    date: { type: Date, default: Date.now, index: true },

    source: { type: String, default: "rondas", trim: true },
    origin: { type: String, default: "", trim: true },

    rondaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RondaIncident",
      default: null,
    },
  },
  { timestamps: true }
);

incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ reportedByGuardId: 1, createdAt: -1 });
incidentSchema.index({ createdByUserId: 1, createdAt: -1 });
incidentSchema.index({ status: 1, priority: 1, createdAt: -1 });

export default mongoose.models.IncidentGlobal ||
  mongoose.model("IncidentGlobal", incidentSchema);