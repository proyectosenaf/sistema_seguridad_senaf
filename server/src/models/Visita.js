import mongoose from "mongoose";
const { Schema } = mongoose;

const VisitaSchema = new Schema(
  {
    // ID_persona (visitante)
    visitante: { type: Schema.Types.ObjectId, ref: "Persona", required: true },

    // ID_empleado (a quién visita)
    empleado: { type: Schema.Types.ObjectId, ref: "Empleado" },

    // ID_Institución_procedente
    institucion: { type: Schema.Types.ObjectId, ref: "Institucion" },

    // ID_usuarios (quien registra) → puedes usar una colección Usuario
    usuario: { type: Schema.Types.ObjectId, ref: "Usuario" },

    // También guardamos snapshot del actor (útil si luego borras el usuario)
    registradoPor: { sub: String, nombre: String, email: String },

    // Datos propios de la visita
    motivo: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },

    estado: {
      type: String,
      enum: ["programada", "en_proceso", "finalizada", "cancelada"],
      default: "en_proceso",
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

/* Búsquedas comunes */
VisitaSchema.index({ fecha: -1 });
VisitaSchema.index({ visitante: 1, fecha: -1 });
VisitaSchema.index({ empleado: 1, fecha: -1 });

/* Permite recibir nombres legacy (con o sin acentos) */
VisitaSchema.statics.fromRequest = function (b = {}) {
  const pick = (...k) => k.find((x) => b[x] !== undefined) && b[k.find((x) => b[x] !== undefined)];
  return {
    visitante: pick("visitante", "ID_persona", "id_persona"),
    empleado: pick("empleado", "ID_empleado", "id_empleado"),
    institucion: pick("institucion", "ID_Institución_procedente", "ID_Institucion_procedente", "id_institucion"),
    usuario: pick("usuario", "ID_usuarios", "id_usuario"),
    registradoPor: pick("registradoPor") || {
      sub: b.user?.sub || b.sub,
      nombre: b.user?.name || b.user?.nombre || b.nombre,
      email: b.user?.email || b.email,
    },
    motivo: pick("motivo", "motivo_visita"),
    fecha: pick("fecha", "fecha_registro"),
    estado: pick("estado", "situacion") || undefined,
  };
};

export default mongoose.model("Visita", VisitaSchema);
