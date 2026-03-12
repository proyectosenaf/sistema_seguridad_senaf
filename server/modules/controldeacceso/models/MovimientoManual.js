import mongoose from "mongoose";

const MovimientoManualSchema = new mongoose.Schema(
  {
    fechaHora: {
      type: Date,
      required: true,
    },

    fechaFin: {
      type: Date,
      default: null,
    },

    noRegresa: {
      type: Boolean,
      default: false,
    },

    tipo: {
      type: String,
      enum: ["Entrada", "Salida", "Permiso"],
      required: true,
      trim: true,
      index: true,
    },

    personaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Empleado",
      default: null,
      index: true,
    },

    persona: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },

    placa: {
      type: String,
      trim: true,
      default: "",
      uppercase: true,
    },

    observacion: {
      type: String,
      trim: true,
      default: "",
    },

    departamento: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ───────────────────── Normalización ───────────────────── */

MovimientoManualSchema.pre("save", function normalizeBeforeSave(next) {
  if (typeof this.persona === "string") {
    this.persona = this.persona.trim();
  }

  if (typeof this.placa === "string") {
    this.placa = this.placa.trim().toUpperCase();
  }

  if (typeof this.observacion === "string") {
    this.observacion = this.observacion.trim();
  }

  if (typeof this.departamento === "string") {
    this.departamento = this.departamento.trim();
  }

  // Si no regresa, fechaFin debe ir en null
  if (this.noRegresa) {
    this.fechaFin = null;
  }

  next();
});

export default mongoose.models.MovimientoManual ||
  mongoose.model("MovimientoManual", MovimientoManualSchema);