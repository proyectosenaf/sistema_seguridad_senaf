// server/modules/supervision/supervision.model.js
import mongoose from "mongoose";

const SupervisionSchema = new mongoose.Schema(
  {
    // Persona supervisada (opcional de momento)
    personaId: {
      type: String,
      default: "",
    },
    personaNombre: {
      type: String,
      default: "",
    },

    // checklist que tienes en Supervision.jsx
    limpiezaAreaTrabajo: {
      type: Boolean,
      default: false,
    },
    herramientasAMano: {
      type: Boolean,
      default: false,
    },
    vestimentaAdecuada: {
      type: Boolean,
      default: false,
    },

    observacion: {
      type: String,
      default: "",
      trim: true,
    },

    // Quién hizo la supervisión (tomado de req.user si viene autenticado)
    supervisadoPorId: {
      type: String,
      default: "",
    },
    supervisadoPorEmail: {
      type: String,
      default: "",
    },
    supervisadoPorNombre: {
      type: String,
      default: "",
    },

    // Por si luego quieres filtrar por sitio / puesto
    sitio: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

export const Supervision = mongoose.model(
  "Supervision",
  SupervisionSchema,
  "supervisiones" // nombre de la colección en Mongo
);
