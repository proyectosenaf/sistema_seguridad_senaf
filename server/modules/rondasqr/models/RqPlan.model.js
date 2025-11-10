import mongoose from "mongoose";

const PointItemSchema = new mongoose.Schema(
  {
    pointId: {
      type: mongoose.Types.ObjectId,
      ref: "RqPoint",
      required: true,
    },
    // orden dentro del plan
    order: { type: Number, default: 0 },

    // ventanas opcionales
    windowStartMin: { type: Number, default: undefined },
    windowEndMin: { type: Number, default: undefined },

    // tolerancia puntual
    toleranceMin: { type: Number, default: undefined },
  },
  { _id: false }
);

const RqPlanSchema = new mongoose.Schema(
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

    // 👇 NUEVO: turno/shift (el frontend ya lo manda)
    // lo dejamos flexible pero indexado
    shift: {
      type: String,
      trim: true,
      default: "dia", // o "diurno", elige uno y sé consistente
      index: true,
    },

    // opcional
    name: { type: String, trim: true },

    version: { type: Number, default: 1 },

    points: {
      type: [PointItemSchema],
      default: [],
      validate: {
        validator(arr) {
          const ids = arr.map((p) => String(p.pointId));
          return ids.length === new Set(ids).size;
        },
        message: "Hay puntos duplicados en el plan.",
      },
    },

    // compat
    pointIds: [{ type: mongoose.Types.ObjectId, ref: "RqPoint", default: [] }],

    windows: [
      {
        label: String,
        startMin: Number,
        endMin: Number,
        _id: false,
      },
    ],

    toleranceMin: { type: Number, default: 5 },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "rq_plans" }
);

/* ------------ índices ------------ */
// antes era {siteId, roundId} unique
// ahora debe ser {siteId, roundId, shift} para permitir 1 por turno
RqPlanSchema.index({ siteId: 1, roundId: 1, shift: 1 }, { unique: true });
RqPlanSchema.index({ active: 1, siteId: 1 });
RqPlanSchema.index({ "points.pointId": 1 });

function toObjIdSafe(v) {
  try {
    if (!v) return null;
    const s = String(v);
    return mongoose.Types.ObjectId.isValid(s)
      ? new mongoose.Types.ObjectId(s)
      : null;
  } catch {
    return null;
  }
}

/* ------------ normalización ------------ */
RqPlanSchema.pre("validate", function normalizePoints(next) {
  try {
    const hasPointsArr = Array.isArray(this.points) && this.points.length > 0;
    const hasPointIds = Array.isArray(this.pointIds) && this.pointIds.length > 0;

    // si no hay points pero sí pointIds, los creamos
    if (!hasPointsArr && hasPointIds) {
      this.points = this.pointIds
        .map((pid, idx) => {
          const oid = toObjIdSafe(pid);
          return oid ? { pointId: oid, order: idx } : null;
        })
        .filter(Boolean);
    }

    const dedup = [];
    const seen = new Set();
    for (const raw of this.points || []) {
      const oid = toObjIdSafe(raw?.pointId);
      if (!oid) continue;
      const key = String(oid);
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push({
        pointId: oid,
        order: Number.isFinite(raw?.order) ? Math.floor(raw.order) : dedup.length,
        windowStartMin: Number.isFinite(raw?.windowStartMin)
          ? raw.windowStartMin
          : undefined,
        windowEndMin: Number.isFinite(raw?.windowEndMin)
          ? raw.windowEndMin
          : undefined,
        toleranceMin: Number.isFinite(raw?.toleranceMin)
          ? raw.toleranceMin
          : undefined,
      });
    }

    dedup.sort((a, b) => (a.order || 0) - (b.order || 0));
    dedup.forEach((p, i) => {
      p.order = i;
    });

    this.points = dedup;
    this.pointIds = (this.points || []).map((p) => p.pointId);

    // shift por defecto si viene vacío
    if (!this.shift) {
      this.shift = "dia";
    }

    next();
  } catch (e) {
    next(e);
  }
});

RqPlanSchema.virtual("pointIdsComputed").get(function () {
  return (this.points || []).map((p) => p.pointId);
});

RqPlanSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    if (!ret.pointIds || ret.pointIds.length === 0) {
      ret.pointIds = (ret.points || []).map((p) => p.pointId);
    }
    return ret;
  },
});

RqPlanSchema.methods.getOrderedPoints = function () {
  return (this.points || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

RqPlanSchema.methods.expectedPointSet = function () {
  return new Set((this.points || []).map((p) => String(p.pointId)));
};

const RqPlan =
  mongoose.models.RqPlan || mongoose.model("RqPlan", RqPlanSchema);

export default RqPlan;
