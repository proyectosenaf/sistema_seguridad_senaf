// server/modules/rondasqr/models/RqRound.model.js
import mongoose from "mongoose";

/* -------------------- Helpers -------------------- */
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-") // no alfanum → guion
    .replace(/(^-|-$)/g, ""); // bordes
}

const RqRoundSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Types.ObjectId,
      ref: "RqSite",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ID legible opcional (slug). Único por sitio.
    code: {
      type: String,
      trim: true,
      lowercase: true,
      // Ojo: la unicidad real se define por índice compuesto (ver abajo)
    },

    description: { type: String, trim: true },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "rq_rounds" }
);

/* -------------------- Índices -------------------- */
// Búsquedas típicas
RqRoundSchema.index({ siteId: 1, name: 1 });
RqRoundSchema.index({ active: 1 });

// Unicidad de `code` por sitio (solo si `code` existe y es string)
RqRoundSchema.index(
  { siteId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: "string" } },
    name: "uniq_round_code_per_site",
  }
);

/* --------- Autogenerar y normalizar `code` --------- */
RqRoundSchema.pre("validate", function (next) {
  // si no viene code, lo generamos desde name
  if (!this.code && this.name) {
    this.code = slugify(this.name) || undefined;
  }
  // si viene code, lo normalizamos igual a slug
  if (this.code) {
    this.code = slugify(this.code);
  }
  next();
});

/* --------------- Normalización JSON --------------- */
RqRoundSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/* --------------- Export seguro en dev --------------- */
export default mongoose.models.RqRound ||
  mongoose.model("RqRound", RqRoundSchema);
