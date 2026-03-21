import mongoose from "mongoose";

const BitacoraEventSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      trim: true,
      required: true,
      default: "",
      index: true,
      unique: true,
    },

    fecha: {
      type: Date,
      default: Date.now,
      index: true,
    },

    modulo: {
      type: String,
      trim: true,
      enum: [
        "Control de Acceso",
        "Rondas de Vigilancia",
        "Control de Visitas",
        "Gestión de Incidentes",
        "IAM",
        "General",
      ],
      default: "General",
      index: true,
    },

    tipo: {
      type: String,
      trim: true,
      enum: ["Acceso", "Ronda", "Visita", "Incidente", "Evento", "IAM"],
      default: "Evento",
      index: true,
    },

    accion: {
      type: String,
      trim: true,
      default: "CREAR",
      index: true,
    },

    entidad: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    entidadId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    agente: {
      type: String,
      trim: true,
      default: "Sistema",
      index: true,
    },

    actorId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    actorEmail: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    actorRol: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    nombre: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    empresa: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    turno: {
      type: String,
      trim: true,
      enum: ["Mañana", "Tarde", "Noche"],
      default: "Mañana",
      index: true,
    },

    titulo: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    descripcion: {
      type: String,
      trim: true,
      default: "",
    },

    prioridad: {
      type: String,
      trim: true,
      enum: ["Baja", "Media", "Alta", "Crítica"],
      default: "Baja",
      index: true,
    },

    estado: {
      type: String,
      trim: true,
      default: "Registrado",
      index: true,
    },

    source: {
      type: String,
      trim: true,
      default: "backend",
      index: true,
    },

    ip: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    userAgent: {
      type: String,
      trim: true,
      default: "",
    },

    visible: {
      type: Boolean,
      default: true,
      index: true,
    },

    archived: {
      type: Boolean,
      default: false,
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },

    archivedBy: {
      type: String,
      trim: true,
      default: "",
    },

    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "bitacora_events",
  }
);

/* ───────── Índices compuestos profesionales ───────── */
BitacoraEventSchema.index({ eventKey: 1 }, { unique: true });
BitacoraEventSchema.index({ modulo: 1, fecha: -1 });
BitacoraEventSchema.index({ tipo: 1, fecha: -1 });
BitacoraEventSchema.index({ actorEmail: 1, fecha: -1 });
BitacoraEventSchema.index({ entidad: 1, entidadId: 1 });
BitacoraEventSchema.index({ archived: 1, fecha: -1 });

export default mongoose.models.BitacoraEvent ||
  mongoose.model("BitacoraEvent", BitacoraEventSchema);