// server/modules/rondasqr/models/RqIncident.model.js
import mongoose from "mongoose";

const RqIncidentSchema = new mongoose.Schema(
  {
    // tipo de incidente
    type: {
      type: String,
      enum: ["panic", "inactivity", "fall", "noncompliance", "custom"],
      default: "custom",
      index: true,
    },

    // Texto libre
    text: { type: String, default: "" },

    // Contexto (sitio/ronda/punto si aplica)
    siteId: { type: String, index: true, sparse: true },
    siteName: { type: String, default: "" },
    roundId: { type: String, index: true, sparse: true },
    roundName: { type: String, default: "" },
    pointId: { type: String, default: "" },
    pointName: { type: String, default: "" },

    // Oficial / guardia
    guardId: { type: String, default: "" },
    guardName: { type: String, default: "" },
    officerName: { type: String, default: "" },
    officerEmail: { type: String, index: true, sparse: true },

    // Momento
    at: { type: Date, default: () => new Date(), index: true },

    // GPS simple
    gps: {
      lat: Number,
      lon: Number,
    },

    // GeoJSON opcional (cuando lo mandas como loc)
    loc: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    // Fotos guardadas en disco
    photos: {
      type: [String],
      default: [],
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
