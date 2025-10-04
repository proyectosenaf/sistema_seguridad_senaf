import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  slaStatus: { type:String, enum:["on_time","late","missed"], default:"on_time" },
  shiftId: { type: ObjectId, ref: "RondasPatrolShift", required: true },
  checkpointId: { type: ObjectId, ref: "RondasCheckpoint", required: true },
  guardId: { type: String, required: true },
  at: { type: Date, default: Date.now },
  geo: { lat:Number, lng:Number, accuracy:Number },
  note: String,
  evidenceUrl: String,
},{ timestamps:true, collection:"senafRondas_scans" });
export default mongoose.model("RondasScanEvent", schema);
