// models/Informe.model.js
const mongoose = require("mongoose");

const InformeSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["incidente", "omision", "ronda", "otro"],
      default: "incidente",
    },

    // referencia al documento original (en este caso, incidente)
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // por si luego quieres hacer populate dinámico
    refModel: {
      type: String,
      default: "RqIncident",
    },

    title: String,
    description: String,

    site: String,
    zone: String,

    priority: String,
    status: String,

    reportedBy: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Informe", InformeSchema);
