// server/modules/rondasqr/models/RqMark.model.js
import mongoose from "mongoose";

const RqMarkSchema = new mongoose.Schema(
  {
    hardwareId: String,             // id del teléfono
    qrNo:       String,             // QR No (del sticker)
    siteId:     { type: mongoose.Schema.Types.ObjectId, ref: "RqSite" },
    roundId:    { type: mongoose.Schema.Types.ObjectId, ref: "RqRound" },
    pointId:    { type: mongoose.Schema.Types.ObjectId, ref: "RqPoint" },
    pointName:  String,
    guardName:  String,
    guardId:    String,             // sub de Auth0 o legajo
    steps:      { type: Number, default: 0 },
    message:    { type: String, default: "" },
    at:         { type: Date, default: Date.now },
    // GeoJSON [lon, lat]
    loc: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { timestamps: true }
);

// 👉 índice geoespacial correcto
RqMarkSchema.index({ loc: "2dsphere" });

// 👉 índice útil para filtros de reportes
RqMarkSchema.index({ at: 1 });
RqMarkSchema.index({ guardId: 1, at: -1 });

export default mongoose.model("RqMark", RqMarkSchema);
