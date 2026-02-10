// server/src/models/Evaluacion.js
import mongoose from "mongoose";

const EvaluacionSchema = new mongoose.Schema(
  {
    // Nombre del empleado / guardia
    empleado: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // "YYYY-MM" o valores tipo "2025-Q3", "2025-S2"
    periodo: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // Mensual / Trimestral / Semestral / Anual
    tipo: {
      type: String,
      default: "Mensual",
      trim: true,
    },

    // ========= Criterios (0–100) =========
    puntualidad: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    tareas: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    comunicacion: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    iniciativa: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    actitud: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Promedio general (0–100)
    promedio: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Excelente / Satisfactorio / Requiere Mejora
    estado: {
      type: String,
      default: "Satisfactorio",
      trim: true,
    },

    observaciones: {
      type: String,
      default: "",
      trim: true,
    },
    recomendaciones: {
      type: String,
      default: "",
      trim: true,
    },

    // Fecha de la evaluación en formato "YYYY-MM-DD"
    fecha: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
  },
  {
    timestamps: true,
  }
);

// índices para consultas frecuentes
EvaluacionSchema.index({ empleado: 1, periodo: 1 });
EvaluacionSchema.index({ periodo: 1, tipo: 1 });

const Evaluacion = mongoose.model("Evaluacion", EvaluacionSchema);
export default Evaluacion;
