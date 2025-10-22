import mongoose from "mongoose";

const RqPointSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Types.ObjectId,
      ref: "RqSite",
      required: true,
      index: true,
    },
    roundId: {
      type: mongoose.Types.ObjectId,
      ref: "RqRound",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true, index: true },

    // Identificadores
    qr:  { type: String, trim: true, index: true }, // Código QR físico
    nfc: { type: String, trim: true },              // Código NFC opcional

    // Orden secuencial dentro de la ronda
    order: { type: Number, default: 0 },

    // Ventana de tolerancia (minutos) desde el arranque del turno/ronda
    window: {
      startMin: { type: Number, default: 0 },
      endMin:   { type: Number, default: 0 },
    },

    // Estado
    active: { type: Boolean, default: true },

    // GeoJSON opcional (SOLO se guarda si hay coords válidas)
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

    // Coordenadas simples (compatibilidad)
    gps: { lat: Number, lon: Number },

    // Notas para el guardia
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "rq_points" }
);

/* -------------------- Índices -------------------- */
// 2dsphere sobre el campo GeoJSON completo
RqPointSchema.index({ loc: "2dsphere" });
RqPointSchema.index({ siteId: 1, roundId: 1, order: 1 });
RqPointSchema.index({ active: 1 });

/* ----------------- Normalización JSON ----------------- */
RqPointSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/* --------------- Saneado de loc en validate --------------- */
RqPointSchema.pre("validate", function (next) {
  const hasLonLat =
    this?.loc?.coordinates &&
    Array.isArray(this.loc.coordinates) &&
    this.loc.coordinates.length === 2 &&
    this.loc.coordinates.every((n) => Number.isFinite(n));

  if (hasLonLat) {
    // Aseguramos type correcto y orden [lon, lat]
    this.loc.type = "Point";
    const [lon, lat] = this.loc.coordinates;
    this.loc.coordinates = [Number(lon), Number(lat)];
  } else {
    // Si no hay coords válidas, removemos loc por completo
    this.loc = undefined;
  }
  next();
});

export default mongoose.model("RqPoint", RqPointSchema);
