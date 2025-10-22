// server/modules/rondasqr/models/RqRound.model.js
import mongoose from "mongoose";

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
      // Ojo: la unicidad real la definimos en un índice compuesto (ver más abajo)
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

// Unicidad de `code` por sitio (si `code` existe y es string)
RqRoundSchema.index(
  { siteId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: "string" } },
    name: "uniq_round_code_per_site",
  }
);

/* -------------------- Helpers -------------------- */
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")     // no alfanum → guion
    .replace(/(^-|-$)/g, "");        // bordes
}

/* --------- Autogenerar `code` si no viene --------- */
RqRoundSchema.pre("validate", function (next) {
  if (!this.code && this.name) {
    const slug = slugify(this.name);
    this.code = slug || undefined;
  }
  next();
});

/* --------------- Normalización JSON --------------- */
RqRoundSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export default mongoose.model("RqRound", RqRoundSchema);
