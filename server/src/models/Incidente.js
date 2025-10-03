// src/models/Incident.js
import mongoose, { Schema, model } from "mongoose";

/** =========================
 * Constantes / Utils
 * ========================= */
const SEVERITY = ["bajo", "medio", "alto", "critico"];
const STATUS   = ["abierto", "en_proceso", "cerrado"];

const CATEGORY = [
  "intrusion",
  "hurto",
  "vandalismo",
  "puerta_forzada",
  "falla_energia",
  "incendio",
  "accidente",
  "otro",
];

const toLower = (s) => (typeof s === "string" ? s.trim().toLowerCase() : s);

/** =========================
 * Sub-schemas
 * ========================= */
const gpsSchema = new Schema(
  { lat: Number, lng: Number, accuracy: Number },
  { _id: false }
);

const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    kind: { type: String, enum: ["photo", "video", "audio", "doc"], default: "photo" },
    caption: String,
  },
  { _id: false }
);

const followUpSchema = new Schema(
  {
    at:   { type: Date, default: () => new Date() },
    by:   { type: String },   // sub o nombre corto del usuario que actuó
    note: { type: String },   // descripción de la acción
    status: { type: String, enum: STATUS }, // opcional: estado al que pasó tras esta acción
    attachments: [mediaSchema],
  },
  { _id: false }
);

const witnessSchema = new Schema(
  {
    name: String,
    contact: String, // tel/correo
    statement: String,
  },
  { _id: false }
);

/** =========================
 * Incident Schema
 * ========================= */
const IncidentSchema = new Schema(
  {
    // Contexto de sitio/ruta/turno
    siteId:       { type: Schema.Types.ObjectId, ref: "Site", index: true },
    routeId:      { type: Schema.Types.ObjectId, ref: "Route", index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "RouteAssignment", index: true },
    shiftId:      { type: Schema.Types.ObjectId, ref: "RondaShift", index: true },

    // Guardia (dos modos, como en tus otros modelos)
    guardId:         { type: Schema.Types.ObjectId, ref: "Guard", index: true },
    guardExternalId: { type: String, index: true }, // Auth0 sub
    guardName:       { type: String },              // cache visible

    // Ubicación y área
    areaFisica: { type: String },      // texto libre (ej. "Bodega 3")
    gps:        gpsSchema,             // coordenadas (si están disponibles)

    // Clasificación del incidente
    tipo:       { type: String, enum: CATEGORY, default: "otro", index: true }, // catálogo
    titulo:     { type: String },   // breve resumen visible
    descripcion:{ type: String },

    // Evidencias
    evidencia:  { type: [mediaSchema], default: [] }, // múltiples archivos
    evidenciaUrl: { type: String }, // compat con tu versión previa (único url) — opcional

    // Severidad, estado y etiquetas
    nivelRiesgo: { type: String, enum: SEVERITY, default: "bajo", index: true },
    estado:      { type: String, enum: STATUS,   default: "abierto", index: true },
    tags:        { type: [String], default: [] }, // keywords/búsquedas

    // Línea de tiempo de seguimiento/acciones
    followUps: { type: [followUpSchema], default: [] },

    // Fechas clave (además de createdAt/updatedAt del timestamps)
    occurredAt: { type: Date, default: () => new Date(), index: true }, // cuándo ocurrió
    acknowledgedAt: { type: Date }, // cuándo alguien lo tomó
    closedAt:       { type: Date }, // cuándo se cerró

    // SLA opcional (tiempos objetivo)
    sla: {
      ackMinutes:   { type: Number, default: 15 },   // tiempo objetivo para "ack"
      closeMinutes: { type: Number, default: 120 },  // tiempo objetivo para "cerrar"
    },

    // Telemetría del cliente (opcional)
    deviceId:   { type: String },
    appVersion: { type: String },

    // Auditoría
    createdBy:  { type: String }, // sub/email
    updatedBy:  { type: String },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        // Normaliza tags a minúsculas, únicas
        if (Array.isArray(ret.tags)) {
          const set = new Set(ret.tags.map(toLower).filter(Boolean));
          ret.tags = Array.from(set);
        }
        return ret;
      },
    },
  }
);

/** =========================
 * Índices compuestos útiles
 * ========================= */
IncidentSchema.index({ siteId: 1, occurredAt: -1 });
IncidentSchema.index({ routeId: 1, occurredAt: -1 });
IncidentSchema.index({ guardExternalId: 1, occurredAt: -1 });
IncidentSchema.index({ estado: 1, nivelRiesgo: 1, occurredAt: -1 });

/** =========================
 * Validaciones/Hooks
 * ========================= */
IncidentSchema.pre("validate", function (next) {
  // Debe existir alguna identificación del guardia si el flujo la requiere
  if (!this.guardId && !this.guardExternalId) {
    // permitimos incidentes creados por admin sin guardia (p.ej., auditoría externa)
    // -> comenta la siguiente línea si quieres hacerla obligatoria:
    // return next(new Error("Debe definirse guardId o guardExternalId"));
  }
  // Normaliza enum flexibles
  if (this.nivelRiesgo) this.nivelRiesgo = toLower(this.nivelRiesgo);
  if (this.estado)      this.estado = toLower(this.estado);
  if (this.tipo)        this.tipo = toLower(this.tipo);
  next();
});

IncidentSchema.pre("save", function (next) {
  // Si pasó a en_proceso y no hay acknowledgedAt, lo seteamos
  if (this.isModified("estado")) {
    if (this.estado === "en_proceso" && !this.acknowledgedAt) {
      this.acknowledgedAt = new Date();
    }
    if (this.estado === "cerrado" && !this.closedAt) {
      this.closedAt = new Date();
    }
    // Si se reabre a abierto, limpiamos closedAt (opcional)
    if (this.estado === "abierto") {
      this.closedAt = undefined;
    }
  }

  // Normaliza tags
  if (Array.isArray(this.tags)) {
    this.tags = Array.from(new Set(this.tags.map(toLower).filter(Boolean)));
  }

  next();
});

/** =========================
 * Virtuales
 * ========================= */
IncidentSchema.virtual("isOpen").get(function () {
  return this.estado !== "cerrado";
});

/** =========================
 * Helpers de instancia
 * ========================= */

/** Añade un seguimiento (y opcionalmente cambia estado) */
IncidentSchema.methods.addFollowUp = function ({ by, note, status, attachments } = {}) {
  this.followUps.push({
    at: new Date(),
    by,
    note,
    status: status && STATUS.includes(toLower(status)) ? toLower(status) : undefined,
    attachments: Array.isArray(attachments) ? attachments : [],
  });

  if (status) {
    const s = toLower(status);
    if (STATUS.includes(s)) this.estado = s;
    if (s === "en_proceso" && !this.acknowledgedAt) this.acknowledgedAt = new Date();
    if (s === "cerrado") this.closedAt = new Date();
  }
  return this;
};

/** Marca como reconocido (acknowledge) */
IncidentSchema.methods.acknowledge = function ({ by, note, attachments } = {}) {
  if (!this.acknowledgedAt) this.acknowledgedAt = new Date();
  this.estado = "en_proceso";
  return this.addFollowUp({ by, note, status: "en_proceso", attachments });
};

/** Cierra el incidente */
IncidentSchema.methods.close = function ({ by, note, attachments } = {}) {
  this.estado = "cerrado";
  this.closedAt = new Date();
  return this.addFollowUp({ by, note, status: "cerrado", attachments });
};

/** Reabre el incidente */
IncidentSchema.methods.reopen = function ({ by, note } = {}) {
  this.estado = "abierto";
  this.closedAt = undefined;
  return this.addFollowUp({ by, note, status: "abierto" });
};

/** KPIs rápidos de SLA */
IncidentSchema.methods.slaMetrics = function () {
  const ackMs   = this.acknowledgedAt ? (this.acknowledgedAt.getTime() - this.occurredAt.getTime()) : null;
  const closeMs = this.closedAt       ? (this.closedAt.getTime()       - this.occurredAt.getTime()) : null;
  return {
    ackMs,
    closeMs,
    ackOk:   ackMs   != null && this.sla?.ackMinutes   != null ? ackMs   <= this.sla.ackMinutes   * 60000 : null,
    closeOk: closeMs != null && this.sla?.closeMinutes != null ? closeMs <= this.sla.closeMinutes * 60000 : null,
  };
};



const Incident = model("Incident", IncidentSchema);
export default Incident;
