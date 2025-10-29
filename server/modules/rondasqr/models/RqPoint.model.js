// server/modules/rondasqr/models/RqPoint.model.js
import mongoose from "mongoose";

const RqPointSchema = new mongoose.Schema(
  {
    siteId:  { type: mongoose.Types.ObjectId, ref: "RqSite",  required: true, index: true },
    roundId: { type: mongoose.Types.ObjectId, ref: "RqRound", required: true, index: true },

    name: { type: String, required: true, trim: true, index: true },

    // Identificadores
    qr:  { type: String, trim: true, index: true }, // Código QR físico
    nfc: { type: String, trim: true },              // opcional

    // Orden secuencial dentro de la ronda (0,1,2…)
    order: { type: Number, default: null, index: true },

    // Ventana de tolerancia (minutos)
    window: {
      startMin: { type: Number, default: 0 },
      endMin:   { type: Number, default: 0 },
    },

    // Estado
    active: { type: Boolean, default: true },

    // GeoJSON opcional (solo si hay coords válidas)
    loc: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: {
        type: [Number], // [lon, lat]
        validate: {
          validator(v) {
            return (
              v == null ||
              (Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n)))
            );
          },
          message: "loc.coordinates debe ser [lon, lat]",
        },
        default: undefined,
      },
    },

    // Coordenadas simples (compatibilidad)
    gps: { lat: Number, lon: Number },

    // Notas
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "rq_points" }
);

/* -------------------- Índices -------------------- */
RqPointSchema.index({ loc: "2dsphere" });
RqPointSchema.index({ siteId: 1, roundId: 1, order: 1 }, { unique: true });
RqPointSchema.index({ active: 1 });
// (opcional) evitar duplicar QR en la misma ronda
RqPointSchema.index({ roundId: 1, qr: 1 }, { unique: true, sparse: true });

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

/* --------------- Saneado de loc --------------- */
RqPointSchema.pre("validate", function (next) {
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
    this.loc = undefined;
  }
  next();
});

/* --------- Asignación automática de 'order' (0..N) --------- */
RqPointSchema.pre("save", async function (next) {
  try {
    if (this.isNew && (this.order === null || this.order === undefined)) {
      const count = await this.constructor.countDocuments({ roundId: this.roundId });
      this.order = count; // siguiente correlativo
    }
    next();
  } catch (err) {
    next(err);
  }
});

/* --------------- Recompactado tras eliminar --------------- */
RqPointSchema.statics.compactAfterDelete = async function (roundId, deletedOrder) {
  await this.updateMany({ roundId, order: { $gt: deletedOrder } }, { $inc: { order: -1 } });
};

// se activa con findOneAndDelete / findByIdAndDelete
RqPointSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.roundId && typeof doc.order === "number") {
    await doc.constructor.compactAfterDelete(doc.roundId, doc.order);
  }
});

/* --------------- Registro del modelo (evita OverwriteModelError) --------------- */
const RqPoint =
  mongoose.models.RqPoint || mongoose.model("RqPoint", RqPointSchema);

export default RqPoint;
