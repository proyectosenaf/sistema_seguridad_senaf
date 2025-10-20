import mongoose from "mongoose";
const RqAlertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["panic", "immobility", "man_down"], required: true, index: true },
    at:   { type: Date, default: Date.now, index: true },
    siteId:  { type: mongoose.Types.ObjectId, ref: "RqSite" },
    roundId: { type: mongoose.Types.ObjectId, ref: "RqRound" },
    officerEmail: String,
    officerName:  String,
    gps: { lat: Number, lon: Number },
    steps: { type: Number, default: 0 },
    acknowledged: { type: Boolean, default: false },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);
export default mongoose.model("RqAlert", RqAlertSchema, "rq_alerts");
