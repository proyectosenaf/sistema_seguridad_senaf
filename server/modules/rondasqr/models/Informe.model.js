// server/modules/rondasqr/models/Informe.model.js
const mongoose = require("mongoose");

const InformeSchema = new mongoose.Schema(
  {
    // qué tipo de cosa estamos registrando
    kind: {
      type: String,
      enum: ["incidente", "omision", "ronda", "otro"],
      default: "incidente",
      index: true,
    },

    // referencia al documento original (puede venir del módulo de incidentes
    // o del de rondas). Lo dejamos NO requerido para que no reviente.
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },

    refModel: {
      type: String,
      default: "RqIncident",
    },

    title: { type: String, default: "" },
    description: { type: String, default: "" },

    zone: { type: String, default: "" },
    siteName: { type: String, default: "" },

    // que coincida con lo que mandas desde el controller
    priority: { type: String, default: "media" },
    status: { type: String, default: "abierto" },

    reportedBy: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

const Informe =
  mongoose.models.Informe || mongoose.model("Informe", InformeSchema);

module.exports = Informe;
