import mongoose from "mongoose";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/; // formato "HH:mm"

const RqAssignmentSchema = new mongoose.Schema(
  {
    // Fecha operativa (YYYY-MM-DD)
    date: { type: String, required: true, index: true },

    // Guardia asignado (Auth0 sub o identificador legado)
    guardId: { type: String, required: true, index: true },

    // Ronda y sitio
    roundId: { type: mongoose.Types.ObjectId, ref: "RqRound", required: true, index: true },
    siteId:  { type: mongoose.Types.ObjectId, ref: "RqSite",  required: false, index: true },

    // Plan vinculado (plan activo al momento de la asignación)
    planId:  { type: mongoose.Types.ObjectId, ref: "RqPlan", required: false, index: true },

    // Snapshot del plan (copiado al crear la asignación)
    planSnap: {
      type: [
        {
          pointId: { type: mongoose.Types.ObjectId, ref: "RqPoint" },
          order: Number,
          windowStartMin: Number,
          windowEndMin: Number,
          toleranceMin: Number,
          _id: false,
        },
      ],
      default: [],
    },

    // Horarios (opcional)
    startTime: { type: String, match: HHMM, default: undefined },
    endTime:   { type: String, match: HHMM, default: undefined },

    // Estado operativo
    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "skipped", "cancelled"],
      default: "assigned",
      index: true,
    },

    // 🔔 Trazabilidad de notificación
    notified:   { type: Boolean, default: false, index: true },
    notifiedAt: { type: Date },
    notifiedBy: { type: String, enum: ["socket", "email", "push", "sms", null], default: null },
  },
  { timestamps: true, collection: "rq_assignments" }
);

// Evita duplicar asignaciones por día
RqAssignmentSchema.index({ date: 1, guardId: 1, roundId: 1 }, { unique: true });

// Limpieza JSON
RqAssignmentSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    if (!Array.isArray(ret.planSnap)) ret.planSnap = [];
    return ret;
  },
});

const RqAssignment =
  mongoose.models.RqAssignment || mongoose.model("RqAssignment", RqAssignmentSchema);

export default RqAssignment;
