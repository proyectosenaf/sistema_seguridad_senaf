// server/src/models/incident.model.js
import mongoose from "mongoose";

const IncidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    reportedBy: { type: String, required: true },
    zone: { type: String, default: "" },
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
    date: { type: Date, default: Date.now },
    // 👇 importante para que el front pueda mostrar las miniaturas
    photos: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const Incident = mongoose.model("Incident", IncidentSchema);
export default Incident;
