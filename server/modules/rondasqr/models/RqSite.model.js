import mongoose from "mongoose";

const RqSiteSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true, trim: true, index: true },
    code:   { type: String, trim: true, unique: true, sparse: true },
    active: { type: Boolean, default: true },

    // GeoJSON opcional (SOLO si hay coords válidas)
    loc: {
      type: {
        type: String,
        enum: ["Point"],
        default: undefined, // no forzamos 'Point' si no hay coords
      },
      coordinates: {
        type: [Number], // [lon, lat]
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
        default: undefined,
      },
    },

    // Notas opcionales
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "rq_sites" }
);

/* -------------------- Índices -------------------- */
// Geoespacial sobre el campo GeoJSON completo
RqSiteSchema.index({ loc: "2dsphere" });
RqSiteSchema.index({ active: 1 });

/* ----------------- Normalización JSON ----------------- */
RqSiteSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/* --------------- Saneado de loc en validate --------------- */
RqSiteSchema.pre("validate", function (next) {
  const hasLonLat =
    this?.loc?.coordinates &&
    Array.isArray(this.loc.coordinates) &&
    this.loc.coordinates.length === 2 &&
    this.loc.coordinates.every((n) => Number.isFinite(n));

  if (hasLonLat) {
    this.loc.type = "Point";
    const [lon, lat] = this.loc.coordinates;
    this.loc.coordinates = [Number(lon), Number(lat)];
  } else {
    this.loc = undefined; // si no hay coords válidas, quitamos loc
  }
  next();
});

export default mongoose.model("RqSite", RqSiteSchema);
