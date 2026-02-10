import mongoose from "mongoose";

const { Schema } = mongoose;

const LocSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number], // [lon, lat]
      default: [],
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
    },
  },
  { _id: false }
);

const RqDeviceSchema = new Schema(
  {
    // Identificación del guardia / usuario
    guardId: { type: String, trim: true },
    officerEmail: { type: String, trim: true },
    officerSub: { type: String, trim: true },

    // Identificación del hardware
    hardwareId: { type: String, trim: true },

    // Último estado local
    lastStepCount: { type: Number, default: 0 },
    lastPingAt: { type: Date },

    // Última posición GPS (opcional)
    lastLoc: LocSchema,

    // 🧠 Campos usados por /offline/dump
    lastProgress: { type: Schema.Types.Mixed, default: {} },
    lastDeviceInfo: { type: Schema.Types.Mixed, default: {} },
    lastDumpAt: { type: Date },

    // Estado general del dispositivo (conectado, inactivo, etc.)
    status: {
      type: String,
      enum: ["online", "offline", "inactive"],
      default: "online",
      index: true, // ok, no lo duplicamos con schema.index
    },
  },
  { timestamps: true, collection: "rq_devices" }
);

/* ──────────────── Índices ──────────────── */
RqDeviceSchema.index({ officerEmail: 1 });
RqDeviceSchema.index({ officerSub: 1 });
RqDeviceSchema.index({ guardId: 1 });
RqDeviceSchema.index({ hardwareId: 1 });
RqDeviceSchema.index({ "lastLoc.coordinates": "2dsphere" });
RqDeviceSchema.index({ lastDumpAt: -1 });

/* ──────────────── Limpieza JSON ──────────────── */
RqDeviceSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/* ──────────────── Registro seguro ──────────────── */
const RqDevice =
  mongoose.models.RqDevice || mongoose.model("RqDevice", RqDeviceSchema);

export default RqDevice;
