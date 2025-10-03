// src/models/RondaEvent.js
import { Schema, model } from "mongoose";

const LocationSchema = new Schema(
  { lat: Number, lng: Number },
  { _id: false }
);

const EvidenceSchema = new Schema(
  {
    kind: { type: String }, // 'photo', 'note', 'audio', ...
    url: { type: String },
    meta: { type: Object },
  },
  { _id: false }
);

const rondaEventSchema = new Schema(
  {
    type: { type: String, enum: ["check", "alert", "incident"], required: true },

    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "RondaShift",
      required: true,
      index: true,
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "Route",
      required: true,
      index: true,
    },

    // haz guardId opcional, y guarda también el externo si lo tienes
    guardId: { type: Schema.Types.ObjectId, ref: "Guard", index: true },
    guardExternalId: { type: String },

    checkpointCode: String,
    checkpointName: String,
    order: Number,

    method: String,
    methodMeta: { type: Object },

    ts: { type: Date, default: Date.now, index: true },
    result: { type: String, enum: ["ok", "late", "invalid"], default: "ok" },
    latencySec: Number,

    location: LocationSchema,
    evidences: [EvidenceSchema],

    deviceId: String,
    appVersion: String,
  },
  { timestamps: true }
);

rondaEventSchema.index({ shiftId: 1, ts: -1 });

rondaEventSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => ret,
});

const RondaEvent = model("RondaEvent", rondaEventSchema);
export default RondaEvent;
