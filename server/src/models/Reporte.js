// src/models/Reporte.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const RangoSchema = new Schema(
  {
    desde: { type: Date },
    hasta: { type: Date },
  },
  { _id: false }
);

const ReporteSchema = new Schema(
  {
    nombre:      { type: String, required: true, trim: true },
    descripcion: { type: String, default: "" },
    tipo: {
      type: String,
      enum: ["incidentes", "accesos", "visitas", "rondas", "bitacora", "evaluacion", "otro"],
      default: "otro",
      index: true,
    },
    rango:   { type: RangoSchema, default: {} },            // { desde, hasta }
    filtros: { type: Schema.Types.Mixed, default: {} },     // criterios dinámicos
    generadoPor: { type: String },                          // p.ej. "sla", "custom"
    creadoPor:   { type: String, required: true },          // sub del usuario o correo
  },
  { timestamps: true }
);

// Índices
ReporteSchema.index({ nombre: "text", descripcion: "text" }); // índice de texto
ReporteSchema.index({ tipo: 1, createdAt: -1 });              // navegación común

export default mongoose.model("Reporte", ReporteSchema);
