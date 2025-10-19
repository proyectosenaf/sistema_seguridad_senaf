import mongoose from "mongoose";
export default mongoose.model("RqDevice", new mongoose.Schema({
  guardId: String,
  hardwareId: String,
  lastStepCount: Number,
  lastPingAt: Date,
  lastLoc: { type: { type: String, default: "Point" }, coordinates: [Number] },
}, { timestamps: true }));