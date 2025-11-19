// server/modules/rondasqr/models/RqAlert.model.js
import mongoose from "mongoose";

const RqAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["panic", "inactivity", "immobility", "man_down"],
      required: true,
      index: true,
    },
    at: { type: Date, default: Date.now, index: true },

    siteId: { type: mongoose.Types.ObjectId, ref: "RqSite" },
    roundId: { type: mongoose.Types.ObjectId, ref: "RqRound" },

    officerEmail: String,
    officerName: String,

    guardId: { type: String, index: true },

    gps: { lat: Number, lon: Number },
    steps: { type: Number, default: 0 },

    acknowledged: { type: Boolean, default: false, index: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: true, collection: "rq_alerts" }
);

export default mongoose.models.RqAlert ||
  mongoose.model("RqAlert", RqAlertSchema, "rq_alerts");
