// server/modules/rondas/models/Alert.js
import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const GeoSchema = new Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    accuracy: { type: Number },
  },
  { _id: false }
);

const OpenCloseSchema = new Schema(
  {
    by: { type: String },
    note: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MetaSchema = new Schema(
  {
    // para missed_checkpoint
    cpCode: { type: String },
    order: { type: Number },
    expectedAt: { type: Date },

    // para incidents
    zoneId: { type: Types.ObjectId, ref: "RondasZone" },
    checkpointId: { type: Types.ObjectId, ref: "RondasCheckpoint" },
    photos: [{ type: String }],
    extra: Schema.Types.Mixed,
  },
  { _id: false }
);

const AlertSchema = new Schema(
  {
    kind: { type: String, required: true }, // "incident" | "missed_checkpoint" | ...
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "ack", "closed"],
      default: "open",
      index: true,
    },

    title: { type: String },
    message: { type: String },

    meta: { type: MetaSchema, default: {} },

    // vínculos
    siteId: { type: Types.ObjectId, ref: "Site" },
    routeId: { type: Types.ObjectId }, // si luego tienes modelo Route/Plan puedes referenciarlo
    assignmentId: { type: Types.ObjectId },
    shiftId: { type: Types.ObjectId, ref: "RondasShift", index: true },

    // guardia
    guardId: { type: String, index: true },
    guardExternalId: { type: String },
    guardName: { type: String },

    // ubicación / fuente / auditoría
    geo: { type: GeoSchema },
    source: { type: String, default: "system" },
    opened: { type: OpenCloseSchema },
    createdBy: { type: String },
    tags: [{ type: String }],

    // cierre opcional
    closed: { type: OpenCloseSchema },
  },
  { timestamps: true }
);

// Método helper que usa tu código
AlertSchema.methods.close = function ({ by = "system", note = "" } = {}) {
  this.status = "closed";
  this.closed = {
    by,
    note,
    at: new Date(),
  };
  return this;
};

// Índices útiles
AlertSchema.index({ kind: 1, status: 1, createdAt: -1 });
AlertSchema.index({ "meta.cpCode": 1, shiftId: 1 });
AlertSchema.index({ "meta.zoneId": 1, createdAt: -1 });
AlertSchema.index({ routeId: 1, createdAt: -1 });
AlertSchema.index({ siteId: 1, createdAt: -1 });

const MODEL_NAME = "RondasAlert";
export default mongoose.models[MODEL_NAME]
  || mongoose.model(MODEL_NAME, AlertSchema, "senafRondas_alerts");
