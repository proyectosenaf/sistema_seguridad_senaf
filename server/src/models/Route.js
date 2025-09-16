// src/models/Route.js
import mongoose from "mongoose";

const GeofenceSchema = new mongoose.Schema({
  type: { type: String, enum: ["circle", "polygon"], required: true },
  center: { lat: Number, lng: Number },
  radiusMeters: { type: Number },
  points: [{ lat: Number, lng: Number }],
}, { _id: false });

const CheckpointSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0, index: true },

  allowedMethods: [{ type: String, enum: ["qr","nfc","finger"] }],
  geofence: GeofenceSchema,

  expectedSecondsFromStart: { type: Number, default: 0 },
  graceSeconds: { type: Number, default: 120 },

  requirePhoto: { type: Boolean, default: false },
  requireNote: { type: Boolean, default: false },

  tags: [{ type: String }],
}, { _id: false });

const WindowSchema = new mongoose.Schema({
  dow: [{ type: Number, min: 0, max: 6 }],
  start: { type: String },
  end:   { type: String },
}, { _id: false });

const RouteSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site" },
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },

  checkpoints: { type: [CheckpointSchema], default: [] },
  windows: { type: [WindowSchema], default: [] },

  sla: {
    lateThresholdSeconds:   { type: Number, default: 180 },
    missingThresholdSeconds:{ type: Number, default: 600 },
  },

  active: { type: Boolean, default: true },

  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

RouteSchema.index({ siteId: 1, name: 1 }, { unique: true });
RouteSchema.index({ "checkpoints.code": 1 });

export default mongoose.model("Route", RouteSchema);
