import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema({
  zoneId:   { type: ObjectId, ref: "RondasZone", required: true },
  guardId:  { type: String, required: true },
  status:   { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
  startAt:  { type: Date, default: Date.now },
  endAt:    { type: Date },
  expectedOrder: [{ type: ObjectId, ref: "RondasCheckpoint" }],
  sla: {
    lateThresholdSeconds: { type: Number, default: 180 }
  }
}, { timestamps: true, collection: "senafRondas_shifts" });

export default mongoose.model("RondasPatrolShift", schema);
