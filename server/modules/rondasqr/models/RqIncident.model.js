// server/modules/rondasqr/models/RqIncident.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const GpsSchema = new Schema(
  {
    lat: { type: Number, default: undefined },
    lon: { type: Number, default: undefined },
  },
  { _id: false }
);

const RqIncidentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["panic", "inactivity", "fall", "noncompliance", "custom", "message"],
      default: "custom",
    },

    text: { type: String, default: "" },

    siteId: { type: String, default: undefined },
    siteName: { type: String, default: "" },

    roundId: { type: String, default: undefined },
    roundName: { type: String, default: "" },

    pointId: { type: String, default: "" },
    pointName: { type: String, default: "" },

    guardId: { type: String, default: "" },
    guardName: { type: String, default: "" },
    officerName: { type: String, default: "" },
    officerEmail: { type: String, default: undefined },
    officerSub: { type: String, default: "" },

    at: { type: Date, default: () => new Date() },

    gps: GpsSchema,

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

    photos: { type: [String], default: [] },

    durationMin: { type: Number, default: null },
    stepsAtAlert: { type: Number, default: null },
    fallDetected: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "rq_incidents",
    versionKey: false,
    minimize: false,
    strict: true,
  }
);

/* Índices */
RqIncidentSchema.index({ type: 1, at: -1 });
RqIncidentSchema.index({ at: -1 });
RqIncidentSchema.index({ officerEmail: 1 }, { sparse: true });
RqIncidentSchema.index({ guardId: 1 }, { sparse: true });
RqIncidentSchema.index({ siteId: 1 }, { sparse: true });
RqIncidentSchema.index({ roundId: 1 }, { sparse: true });
RqIncidentSchema.index({ loc: "2dsphere" }, { sparse: true });

/* Sincronización gps <-> loc */
RqIncidentSchema.pre("save", function syncGpsToLoc(next) {
  try {
    const hasGps =
      this?.gps &&
      typeof this.gps.lat === "number" &&
      Number.isFinite(this.gps.lat) &&
      typeof this.gps.lon === "number" &&
      Number.isFinite(this.gps.lon);

    if (hasGps) {
      this.loc = this.loc || {};
      this.loc.type = "Point";
      this.loc.coordinates = [this.gps.lon, this.gps.lat];
    } else if (
      this?.loc?.coordinates &&
      Array.isArray(this.loc.coordinates) &&
      this.loc.coordinates.length >= 2 &&
      typeof this.loc.coordinates[0] === "number" &&
      typeof this.loc.coordinates[1] === "number"
    ) {
      this.gps = this.gps || {};
      this.gps.lon = this.loc.coordinates[0];
      this.gps.lat = this.loc.coordinates[1];
    } else {
      this.loc = undefined;
    }
  } catch (err) {
    console.warn("[RqIncident.preSave] Error sincronizando GPS:", err.message);
  }
  next();
});

/* JSON limpio */
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

const RqIncident =
  mongoose.models.RqIncident ||
  mongoose.model("RqIncident", RqIncidentSchema, "rq_incidents");

export default RqIncident;