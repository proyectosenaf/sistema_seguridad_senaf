import mongoose from "mongoose";

const SupervisionSchema = new mongoose.Schema({
  // dato del guardia supervisado
  guardia: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },

  // origen
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "SupervisionPlan", default: null },
  programada: { type: Boolean, default: false },

  // ejecución
  fecha: { type: Date, default: Date.now },
  estado: { type: String, enum: ["abierta","cerrada"], default: "abierta" },

  // calificación
  puntaje: { type: Number, min: 0, max: 100, default: 80 },
  observaciones: { type: String, trim: true },

  // checklist opcional (para crecer a futuro)
  checklist: [{
    nombre: String,
    valor: Number,    // 0/1 o 0..100
    peso: Number      // 0..100
  }],

  // quién supervisó
  supervisor: { sub: String, name: String, email: String },

  // para evaluación mensual
  periodo: { type: String }, // "YYYY-MM"

  // auditoría
  createdBy: { sub: String, name: String, email: String },
}, { timestamps: true });

export default mongoose.model("Supervision", SupervisionSchema);
