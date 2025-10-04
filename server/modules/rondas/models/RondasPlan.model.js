import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const planSchema = new mongoose.Schema(
  {
    // Nombre visible del plan (ej. "Ronda nocturna A")
    name: { type: String, required: true, trim: true },

    // Zona a la que pertenece el plan
    zoneId: { type: ObjectId, ref: "RondasZone", required: true },

    // Días de la semana (0=Dom ... 6=Sáb)
    daysOfWeek: {
      type: [Number],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every(n => n >= 0 && n <= 6),
        message: "daysOfWeek debe contener valores 0..6",
      },
    },

    // Jornada del plan
    scheduleType: { type: String, enum: ["day", "night"], default: "day" },

    // Horas en formato HH:mm (requeridas)
    startTime: { type: String, required: true }, // p.ej. "08:00" o "22:00"
    endTime:   { type: String, required: true }, // p.ej. "16:00" o "06:00" (puede cruzar medianoche)

    // Cada cuánto repetir (min). 0 = una vez por día programado
    repeatEveryMinutes: { type: Number, default: 0 },

    // Tolerancia por defecto (segundos) para considerar “tarde” si el turno no lo define
    lateThresholdSeconds: { type: Number, default: 180 },

    // Estado
    active: { type: Boolean, default: true },

    // Auditoría básica
    createdBy: { type: String },
  },
  { timestamps: true, collection: "senafRondas_plans" }
);

export default mongoose.model("RondasPlan", planSchema);
