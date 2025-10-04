import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  zoneId: { type: ObjectId, ref: "RondasZone", required: true },
  code:   { type: String, required: true, unique: true },
  name:   { type: String, required: true },
  order:  { type: Number, default: 1 },
  qrPayload: { type: String, required: true },
  expectedSecondsFromStart: { type: Number, default: 0 },
  graceSeconds: { type: Number, default: 60 },
  active: { type: Boolean, default: true },
},{ timestamps:true, collection:"senafRondas_checkpoints" });
export default mongoose.model("RondasCheckpoint", schema);
