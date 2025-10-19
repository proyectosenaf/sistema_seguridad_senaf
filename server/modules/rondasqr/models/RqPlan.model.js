import mongoose from "mongoose";

const PointItemSchema = new mongoose.Schema(
  {
    pointId: {
      type: mongoose.Types.ObjectId,
      ref: "RqPoint",
      required: true,
    },
    // Orden secuencial dentro de la ronda
    order: { type: Number, default: 0 },

    // Ventana esperada opcional para este punto (minutos desde el inicio de la ronda/turno)
    windowStartMin: { type: Number, default: undefined },
    windowEndMin: { type: Number, default: undefined },

    // Tolerancia puntual (si no se define, hereda del plan)
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

    // Nombre/etiqueta del plan (útil si manejas varias versiones)
    name: { type: String, trim: true },

    // Versión simple para diferenciar cambios (no obligatorio)
    version: { type: Number, default: 1 },

    // ✅ Estructura rica de puntos con orden y ventanas
    points: {
      type: [PointItemSchema],
      default: [],
      validate: {
        validator(arr) {
          // no duplicados por pointId
          const ids = arr.map((p) => String(p.pointId));
          return ids.length === new Set(ids).size;
        },
        message: "Hay puntos duplicados en el plan.",
      },
    },

    // ⬇️ Retrocompatibilidad con tu campo anterior
    pointIds: [{ type: mongoose.Types.ObjectId, ref: "RqPoint" }],

    // Ventanas globales opcionales (para turnos/labels)
    windows: [
      {
        label: String,
        startMin: Number,
        endMin: Number,
        _id: false,
      },
    ],

    // Tolerancia global (min) para considerar retraso/omisión si no se especifica en el punto
    toleranceMin: { type: Number, default: 5 },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "rq_plans" }
);

// Índices
// Un plan activo por site+round (si quieres permitir múltiples versiones activas, elimina el unique)
RqPlanSchema.index({ siteId: 1, roundId: 1 }, { unique: true });
RqPlanSchema.index({ active: 1, siteId: 1 });
RqPlanSchema.index({ "points.pointId": 1 });

// --- Hooks & helpers ---

// Pre-validate: si viene `pointIds`, los convierte en `points` con orden incremental
RqPlanSchema.pre("validate", function normalizePoints(next) {
  try {
    if ((!this.points || this.points.length === 0) && Array.isArray(this.pointIds) && this.pointIds.length > 0) {
      this.points = this.pointIds.map((pid, idx) => ({
        pointId: pid,
        order: idx,
      }));
    }
    // Ordena por "order" por si viene desordenado
    if (Array.isArray(this.points) && this.points.length > 0) {
      this.points.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Virtual sólo-lectura para exponer pointIds desde points (retrocompatibilidad)
RqPlanSchema.virtual("pointIdsComputed").get(function () {
  return (this.points || []).map((p) => p.pointId);
});

// Salida limpia
RqPlanSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    // Por compatibilidad, si alguien consume pointIds, que lo tenga
    if (!ret.pointIds || ret.pointIds.length === 0) {
      ret.pointIds = (ret.points || []).map((p) => p.pointId);
    }
    return ret;
  },
});

// Métodos de utilidad para el backend (reportes/omisiones)
RqPlanSchema.methods.getOrderedPoints = function () {
  return (this.points || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
};

RqPlanSchema.methods.expectedPointSet = function () {
  return new Set((this.points || []).map((p) => String(p.pointId)));
};

export default mongoose.model("RqPlan", RqPlanSchema);
