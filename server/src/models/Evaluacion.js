// server/src/models/Evaluacion.js
import mongoose from "mongoose";

const EvaluacionSchema = new mongoose.Schema(
  {
    empleado: { type: String, required: true, index: true },
    periodo:  { type: String, required: true, index: true }, // "YYYY-MM" o "2025-Q3"
    tipo:     { type: String, default: "Mensual" },

    puntualidad:  { type: Number, min: 0, max: 100, default: 0 },
    tareas:       { type: Number, min: 0, max: 100, default: 0 },
    comunicacion: { type: Number, min: 0, max: 100, default: 0 },
    iniciativa:   { type: Number, min: 0, max: 100, default: 0 },
    actitud:      { type: Number, min: 0, max: 100, default: 0 },

    promedio: { type: Number, min: 0, max: 100, default: 0 },
    estado:   { type: String, default: "Satisfactorio" },

    observaciones:   { type: String, default: "" },
    recomendaciones: { type: String, default: "" },

    fecha: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  },
  { timestamps: true }
);

EvaluacionSchema.index({ empleado: 1, periodo: 1 });
EvaluacionSchema.index({ periodo: 1, tipo: 1 });

const Evaluacion = mongoose.model("Evaluacion", EvaluacionSchema);
export default Evaluacion;

