// server/modules/rondasqr/models/RqIncident.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const RqIncidentSchema = new Schema(
  {
    // tipo de incidente
    type: {
      type: String,
      enum: ["panic", "inactivity", "fall", "noncompliance", "custom"],
      default: "custom",
    },

    // Texto libre
    text: { type: String, default: "" },

    // Contexto (sitio/ronda/punto si aplica)
    siteId: { type: String, default: undefined },
    siteName: { type: String, default: "" },

    roundId: { type: String, default: undefined },
    roundName: { type: String, default: "" },

    pointId: { type: String, default: "" },
    pointName: { type: String, default: "" },

    // Oficial / guardia
    guardId: { type: String, default: "" },
    guardName: { type: String, default: "" },
    officerName: { type: String, default: "" },
    officerEmail: { type: String, default: undefined },

    // Momento
    at: { type: Date, default: () => new Date() },

    // GPS simple
    gps: {
      lat: { type: Number, default: undefined },
      lon: { type: Number, default: undefined },
    },

    // GeoJSON opcional (cuando lo mandas como loc)
    loc: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lon, lat]
        default: undefined,
        validate: {
          validator(v) {
            return (
              v == null ||
              (Array.isArray(v) &&
                v.length === 2 &&
                v.every((n) => Number.isFinite(n)))
            );
          },
          message: "loc.coordinates debe ser [lon, lat]",
        },
      },
    },

    // Fotos guardadas en disco
    photos: { type: [String], default: [] },

    // Extra para alertas:
    durationMin: { type: Number, default: null }, // minutos de inactividad
    stepsAtAlert: { type: Number, default: null }, // pasos al disparar
    fallDetected: { type: Boolean, default: false }, // para type=fall
  },
  { timestamps: true, collection: "rq_incidents" }
);

/* ──────────────── Índices (sin duplicar) ──────────────── */
RqIncidentSchema.index({ type: 1, at: -1 });
RqIncidentSchema.index({ at: -1 });
RqIncidentSchema.index({ officerEmail: 1 }, { sparse: true });
RqIncidentSchema.index({ guardId: 1 });
RqIncidentSchema.index({ siteId: 1 }, { sparse: true });
RqIncidentSchema.index({ roundId: 1 }, { sparse: true });
RqIncidentSchema.index({ loc: "2dsphere" }, { sparse: true });

/* ──────────────── Limpieza JSON ──────────────── */
RqIncidentSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    if (!Array.isArray(ret.photos)) ret.photos = [];
    return ret;
  },
});

/* ──────────────── Registro seguro ──────────────── */
const RqIncident =
  mongoose.models.RqIncident || mongoose.model("RqIncident", RqIncidentSchema);

export default RqIncident;
