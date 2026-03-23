// server/modules/rondasqr/models/RqIncident.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const GpsSchema = new Schema(
  {
    lat: { type: Number, default: undefined },
    lon: { type: Number, default: undefined },
    accuracy: { type: Number, default: undefined },
    altitude: { type: Number, default: undefined },
    heading: { type: Number, default: undefined },
    speed: { type: Number, default: undefined },
    capturedAt: { type: Date, default: undefined },
    source: { type: String, default: "" },
    coordsText: { type: String, default: "" },
  },
  { _id: false }
);

const LinkSchema = new Schema(
  {
    googleMapsUrl: { type: String, default: "" },
    wazeUrl: { type: String, default: "" },
  },
  { _id: false }
);

const LocationMetaSchema = new Schema(
  {
    lat: { type: Number, default: undefined },
    lon: { type: Number, default: undefined },
    accuracy: { type: Number, default: undefined },
    coordsText: { type: String, default: "" },
    googleMapsUrl: { type: String, default: "" },
    wazeUrl: { type: String, default: "" },
    capturedAt: { type: Date, default: undefined },
  },
  { _id: false }
);

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function toDateOrUndefined(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const RqIncidentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["panic", "inactivity", "fall", "noncompliance", "custom", "message"],
      default: "custom",
    },

    text: { type: String, default: "" },

    title: { type: String, default: "" },
    message: { type: String, default: "" },
    body: { type: String, default: "" },
    source: { type: String, default: "" },

    siteId: { type: String, default: undefined },
    siteName: { type: String, default: "" },

    roundId: { type: String, default: undefined },
    roundName: { type: String, default: "" },

    pointId: { type: String, default: "" },
    pointName: { type: String, default: "" },

    guardId: { type: String, default: "" },
    guardName: { type: String, default: "" },
    guardEmail: { type: String, default: undefined },

    officerName: { type: String, default: "" },
    officerEmail: { type: String, default: undefined },
    officerSub: { type: String, default: "" },

    at: { type: Date, default: () => new Date() },

    gps: GpsSchema,
    location: LocationMetaSchema,
    links: LinkSchema,

    loc: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
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

RqIncidentSchema.index({ type: 1, at: -1 });
RqIncidentSchema.index({ at: -1 });
RqIncidentSchema.index({ officerEmail: 1 }, { sparse: true });
RqIncidentSchema.index({ guardId: 1 }, { sparse: true });
RqIncidentSchema.index({ guardEmail: 1 }, { sparse: true });
RqIncidentSchema.index({ siteId: 1 }, { sparse: true });
RqIncidentSchema.index({ roundId: 1 }, { sparse: true });
RqIncidentSchema.index({ loc: "2dsphere" }, { sparse: true });

RqIncidentSchema.pre("save", function syncGpsToLoc(next) {
  try {
    const hasGps =
      this?.gps &&
      isFiniteNumber(this.gps.lat) &&
      isFiniteNumber(this.gps.lon);

    if (hasGps) {
      this.loc = this.loc || {};
      this.loc.type = "Point";
      this.loc.coordinates = [this.gps.lon, this.gps.lat];

      this.location = this.location || {};
      this.location.lat = this.gps.lat;
      this.location.lon = this.gps.lon;

      if (isFiniteNumber(this.gps.accuracy)) {
        this.location.accuracy = this.gps.accuracy;
      }

      if (!this.location.coordsText) {
        this.location.coordsText = `${this.gps.lat}, ${this.gps.lon}`;
      }

      if (!this.location.capturedAt && this.gps.capturedAt) {
        this.location.capturedAt = toDateOrUndefined(this.gps.capturedAt);
      }

      this.links = this.links || {};
      if (!this.links.googleMapsUrl && this.location.coordsText) {
        this.links.googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(
          this.location.coordsText
        )}`;
      }
      if (!this.links.wazeUrl && this.location.coordsText) {
        this.links.wazeUrl = `https://waze.com/ul?ll=${encodeURIComponent(
          this.location.coordsText
        )}&navigate=yes`;
      }

      if (!this.location.googleMapsUrl && this.links.googleMapsUrl) {
        this.location.googleMapsUrl = this.links.googleMapsUrl;
      }
      if (!this.location.wazeUrl && this.links.wazeUrl) {
        this.location.wazeUrl = this.links.wazeUrl;
      }
    } else if (
      this?.loc?.coordinates &&
      Array.isArray(this.loc.coordinates) &&
      this.loc.coordinates.length >= 2 &&
      isFiniteNumber(this.loc.coordinates[0]) &&
      isFiniteNumber(this.loc.coordinates[1])
    ) {
      this.gps = this.gps || {};
      this.gps.lon = this.loc.coordinates[0];
      this.gps.lat = this.loc.coordinates[1];

      this.location = this.location || {};
      this.location.lon = this.loc.coordinates[0];
      this.location.lat = this.loc.coordinates[1];

      if (!this.location.coordsText) {
        this.location.coordsText = `${this.gps.lat}, ${this.gps.lon}`;
      }

      this.links = this.links || {};
      if (!this.links.googleMapsUrl && this.location.coordsText) {
        this.links.googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(
          this.location.coordsText
        )}`;
      }
      if (!this.links.wazeUrl && this.location.coordsText) {
        this.links.wazeUrl = `https://waze.com/ul?ll=${encodeURIComponent(
          this.location.coordsText
        )}&navigate=yes`;
      }

      if (!this.location.googleMapsUrl && this.links.googleMapsUrl) {
        this.location.googleMapsUrl = this.links.googleMapsUrl;
      }
      if (!this.location.wazeUrl && this.links.wazeUrl) {
        this.location.wazeUrl = this.links.wazeUrl;
      }
    } else {
      this.loc = undefined;
    }

    if (this.gps?.capturedAt) {
      this.gps.capturedAt = toDateOrUndefined(this.gps.capturedAt);
    }

    if (this.location?.capturedAt) {
      this.location.capturedAt = toDateOrUndefined(this.location.capturedAt);
    }

    if (!this.guardEmail && this.officerEmail) {
      this.guardEmail = this.officerEmail;
    }

    if (!this.guardName && this.officerName) {
      this.guardName = this.officerName;
    }

    if (!this.message && this.text) {
      this.message = this.text;
    }

    if (!this.body && this.message) {
      this.body = this.message;
    }

    if (!this.text && this.message) {
      this.text = this.message;
    }
  } catch (err) {
    console.warn("[RqIncident.preSave] Error sincronizando GPS:", err.message);
  }
  next();
});

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