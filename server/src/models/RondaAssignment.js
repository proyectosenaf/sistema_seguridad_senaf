import { Schema, model } from "mongoose";

const scheduleSchema = new Schema(
  {
    // Usa UNO de los dos: freqMinutes o cron (cron opcional si en el futuro quieres algo más complejo)
    freqMinutes: { type: Number, min: 1 }, 
    cron: { type: String },

    // Días de la semana permitidos (0=Dom ... 6=Sab). Por defecto laborales.
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },

    // Ventana horaria local del sitio (HH:mm)
    window: {
      start: { type: String, default: "00:00" },
      end: { type: String, default: "23:59" },
    },

    tz: { type: String, default: "UTC" },
  },
  { _id: false }
);

const rondaAssignmentSchema = new Schema(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", index: true },

    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    guardId: { type: Schema.Types.ObjectId, ref: "Guard", required: true, index: true },
    guardExternalId: { type: String, index: true },

    active: { type: Boolean, default: true, index: true },

    schedule: { type: scheduleSchema, default: () => ({}) },
    lastRunAt: { type: Date },
  },
  { timestamps: true }
);

rondaAssignmentSchema.set("toJSON", { versionKey: false, transform: (_d, ret) => ret });

export default model("RondaAssignment", rondaAssignmentSchema);
