// server/modules/rondasqr/models/RqPlan.model.js
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

    // Ventana esperada opcional (minutos desde el inicio de la ronda/turno)
    windowStartMin: { type: Number, default: undefined },
    windowEndMin:   { type: Number, default: undefined },

    // Tolerancia puntual (si no se define, hereda del plan)
    toleranceMin:   { type: Number, default: undefined },
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

    // Estructura rica de puntos
    points: {
      type: [PointItemSchema],
      default: [],
      // Dejamos el validador, pero haremos la deduplicación previa en pre-validate
      validate: {
        validator(arr) {
          const ids = arr.map((p) => String(p.pointId));
          return ids.length === new Set(ids).size;
        },
        message: "Hay puntos duplicados en el plan.",
      },
    },

    // Retrocompatibilidad con tu campo anterior
    pointIds: [{ type: mongoose.Types.ObjectId, ref: "RqPoint", default: [] }],

    // Ventanas globales opcionales (para turnos/labels)
    windows: [
      {
        label: String,
        startMin: Number,
        endMin: Number,
        _id: false,
      },
    ],

    // Tolerancia global (min) para retraso/omisión si no se especifica en el punto
    toleranceMin: { type: Number, default: 5 },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "rq_plans" }
);

/* -------------------- Índices -------------------- */
// Un plan por site+round (si quisieras múltiples versiones activas, quita unique)
RqPlanSchema.index({ siteId: 1, roundId: 1 }, { unique: true });
RqPlanSchema.index({ active: 1, siteId: 1 });
RqPlanSchema.index({ "points.pointId": 1 });

/* -------------------- Helpers internos -------------------- */
function toObjIdSafe(v) {
  try {
    if (!v) return null;
    const s = String(v);
    return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
  } catch {
    return null;
  }
}

/* -------------------- Pre-validate: normalización robusta -------------------- */
/**
 * - Si viene pointIds y points vacío → crea points a partir de pointIds (0..N-1)
 * - Deduplica por pointId (mantiene la primera ocurrencia)
 * - Filtra pointId inválidos
 * - Reasigna order = 0..N-1 (siempre)
 * - Sincroniza pointIds desde points
 */
RqPlanSchema.pre("validate", function normalizePoints(next) {
  try {
    const hasPointsArr = Array.isArray(this.points) && this.points.length > 0;
    const hasPointIds  = Array.isArray(this.pointIds) && this.pointIds.length > 0;

    // 1) Construir "points" desde pointIds si no hay "points"
    if (!hasPointsArr && hasPointIds) {
      this.points = this.pointIds
        .map((pid, idx) => {
          const oid = toObjIdSafe(pid);
          return oid ? { pointId: oid, order: idx } : null;
        })
        .filter(Boolean);
    }

    // 2) Normalizar "points" (dedupe, filtrar inválidos)
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
        windowStartMin: Number.isFinite(raw?.windowStartMin) ? raw.windowStartMin : undefined,
        windowEndMin:   Number.isFinite(raw?.windowEndMin)   ? raw.windowEndMin   : undefined,
        toleranceMin:   Number.isFinite(raw?.toleranceMin)   ? raw.toleranceMin   : undefined,
      });
    }

    // 3) Ordenar por 'order' y reasignar 0..N-1 para que quede compacto
    dedup.sort((a, b) => (a.order || 0) - (b.order || 0));
    dedup.forEach((p, i) => { p.order = i; });

    this.points = dedup;

    // 4) Mantener pointIds en sincronía (retrocompatibilidad)
    this.pointIds = (this.points || []).map((p) => p.pointId);

    next();
  } catch (e) {
    next(e);
  }
});

/* -------------------- Virtuals / salida limpia -------------------- */
RqPlanSchema.virtual("pointIdsComputed").get(function () {
  return (this.points || []).map((p) => p.pointId);
});

RqPlanSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    // Por compat, si no hay pointIds explícito, exponer desde points
    if (!ret.pointIds || ret.pointIds.length === 0) {
      ret.pointIds = (ret.points || []).map((p) => p.pointId);
    }
    return ret;
  },
});

/* -------------------- Métodos de utilidad -------------------- */
RqPlanSchema.methods.getOrderedPoints = function () {
  return (this.points || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
};

RqPlanSchema.methods.expectedPointSet = function () {
  return new Set((this.points || []).map((p) => String(p.pointId)));
};

/* -------------------- Registro del modelo -------------------- */
const RqPlan =
  mongoose.models.RqPlan || mongoose.model("RqPlan", RqPlanSchema);

export default RqPlan;
