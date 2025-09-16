// src/models/RondaShift.js
import mongoose from "mongoose";

const MetricsSchema = new mongoose.Schema({
  completedCount: { type: Number, default: 0 },
  lateCount: { type: Number, default: 0 },
  missingCount: { type: Number, default: 0 },
  invalidCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 }, // 0-100
}, { _id: false });

const RondaShiftSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site" },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
  guardId: { type: mongoose.Schema.Types.ObjectId, ref: "Guard", required: true },

  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },

  expectedCount: { type: Number, default: 0 },
  metrics: { type: MetricsSchema, default: () => ({}) },

  status: { type: String, enum: ["active","finished","cancelled"], default: "active", index: true },

  // auditoría
  startedBy: { type: String },   // sub/email supervisor que inició manualmente
  finishedBy: { type: String },
  cancelledReason: { type: String },

  // Info del dispositivo que inició
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
  appVersion: { type: String },
}, { timestamps: true });

RondaShiftSchema.index({ siteId: 1, routeId: 1, status: 1, startedAt: -1 });
export default mongoose.model("RondaShift", RondaShiftSchema);
