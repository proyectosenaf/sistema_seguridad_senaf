// src/models/RondaEvent.js
import mongoose from "mongoose";

const EvidenceSchema = new mongoose.Schema({
  type: { type: String, enum: ["photo","audio","video","file","note"], required: true },
  url:  { type: String },
  size: { type: Number },        // bytes
  mime: { type: String },
  text: { type: String },        // para notas
}, { _id: false });

const RondaEventSchema = new mongoose.Schema({
  type: { type: String, enum: ["check","exception","note"], default: "check", index: true },

  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "RondaShift", required: true, index: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true, index: true },
  guardId: { type: mongoose.Schema.Types.ObjectId, ref: "Guard", required: true, index: true },

  checkpointCode: { type: String, index: true },
  checkpointName: { type: String },
  order: { type: Number }, // order del checkpoint cuando se creó

  method: { type: String, enum: ["qr","nfc","finger"], required: true },
  methodMeta: { type: Object }, // UID NFC, hash verificación biométrica (no template)

  ts: { type: Date, default: Date.now, index: true },

  // Resultado SLA
  result: { type: String, enum: ["ok","late","invalid","out_of_order","missed"], default: "ok" },
  latencySec: { type: Number, default: 0 },

  // Ubicación del check (si el dispositivo la comparte)
  location: {
    lat: Number,
    lng: Number,
    accuracy: Number, // metros
  },

  // Dispositivo
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
  appVersion: { type: String },

  // Evidencias
  evidences: { type: [EvidenceSchema], default: [] },

  // Auditoría
  createdBy: { type: String },
}, { timestamps: true });

RondaEventSchema.index({ routeId: 1, ts: -1 });
RondaEventSchema.index({ guardId: 1, ts: -1 });
export default mongoose.model("RondaEvent", RondaEventSchema);
