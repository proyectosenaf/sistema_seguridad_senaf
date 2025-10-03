import mongoose from "mongoose";

const EvaluacionSchema = new mongoose.Schema(
  {
    empleado: { type: String, required: true, trim: true },      // guardia
    periodo:  { type: String, required: true, match: /^[0-9]{4}-[0-9]{2}$/ }, // YYYY-MM
    puntuacion: { type: Number, min: 0, max: 100, required: true },
    observaciones: { type: String, default: "" },
    fuente: { type: String, enum: ["manual", "supervision"], default: "manual" },
    creadoPor: { sub: String, name: String, email: String },
  },
  { timestamps: true }
);

// evita duplicados por empleado+periodo
EvaluacionSchema.index({ empleado: 1, periodo: 1 }, { unique: true });

export default mongoose.model("Evaluacion", EvaluacionSchema);
// (Opcional) Puedes agregar métodos estáticos o de instancia si es necesario
// Ejemplo: EvaluacionSchema.statics.findByEmpleado = function(empleado) { return this.find({ empleado }); };
// Ejemplo: EvaluacionSchema.methods.isManual = function() { return this.fuente === 'manual'; };        