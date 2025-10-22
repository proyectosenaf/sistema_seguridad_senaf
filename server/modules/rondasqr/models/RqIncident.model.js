// server/modules/rondasqr/models/RqIncident.model.js
import mongoose from "mongoose";

const RqIncidentSchema = new mongoose.Schema(
  {
    // panic | inactivity | fall | noncompliance | custom
    type: {
      type: String,
      enum: ["panic", "inactivity", "fall", "noncompliance", "custom"],
      default: "custom",
      index: true,
    },

    // Texto libre (ej: “Botón de pánico activado”, “Inmovilidad 60 min”, etc.)
    text: { type: String, default: "" },

    // Contexto (sitio/ronda/punto si aplica)
    siteId: { type: String, index: true, sparse: true },
    siteName: { type: String, default: "" },
    roundId: { type: String, index: true, sparse: true },
    roundName: { type: String, default: "" },
    pointId: { type: String, default: "" },
    pointName: { type: String, default: "" },

    // Oficial
    officerName: { type: String, default: "" },
    officerEmail: { type: String, index: true, sparse: true },

    // Momento
    at: { type: Date, default: () => new Date(), index: true },

    // GPS
    gps: {
      lat: Number,
      lon: Number,
    },

    // Extra para alertas:
    durationMin: { type: Number, default: null }, // minutos de inactividad
    stepsAtAlert: { type: Number, default: null }, // pasos al disparar
    fallDetected: { type: Boolean, default: false }, // para type=fall
  },
  { timestamps: true }
);

const RqIncident =
  mongoose.models.RqIncident || mongoose.model("RqIncident", RqIncidentSchema);
export default RqIncident;
