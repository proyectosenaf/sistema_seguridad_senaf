// src/models/Alert.js
import mongoose, { Schema, model } from "mongoose";

/** =========================
 * Constantes / Utils
 * ========================= */
const ALERT_KINDS = [
  "late_scan",            // escaneo tardío
  "missed_checkpoint",    // punto omitido
  "invalid_scan",         // escaneo inválido (fuera de geocerca, punto no esperado, etc.)
  "geofence_violation",   // violación de geocerca (si la defines a nivel guardia/área)
  "sos",                  // botón SOS
  "route_off_schedule",   // inicio/final fuera de ventana programada
  "device_anomaly",       // problemas de dispositivo / versión
  "custom",               // otras definidas por negocio
];

const SEVERITY = ["low", "medium", "high", "critical"];
const STATUS   = ["open", "ack", "closed"];

const toLower = (s) => (typeof s === "string" ? s.trim().toLowerCase() : s);

/** =========================
 * Sub-schemas
 * ========================= */
const gpsSchema = new Schema(
  { lat: Number, lng: Number, accuracy: Number },
  { _id: false }
);

const actorSchema = new Schema(
  {
    by:   { type: String }, // sub/email que actúa
    at:   { type: Date, default: () => new Date() },
    note: { type: String },
  },
  { _id: false }
);

/** =========================
 * Alert Schema
 * ========================= */
const AlertSchema = new Schema(
  {
    // Contexto
    siteId:       { type: Schema.Types.ObjectId, ref: "Site", index: true },
    routeId:      { type: Schema.Types.ObjectId, ref: "Route", index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "RouteAssignment", index: true },
    shiftId:      { type: Schema.Types.ObjectId, ref: "RondaShift", index: true },
    scanId:       { type: Schema.Types.ObjectId, ref: "Scan", index: true },
    incidentId:   { type: Schema.Types.ObjectId, ref: "Incident", index: true },

    // Guardia (dos modos, como en el resto)
    guardId:         { type: Schema.Types.ObjectId, ref: "Guard", index: true },
    guardExternalId: { type: String, index: true },
    guardName:       { type: String },

    // Clasificación
    kind:     { type: String, enum: ALERT_KINDS, required: true, index: true },
    severity: { type: String, enum: SEVERITY, default: "medium", index: true },
    status:   { type: String, enum: STATUS,   default: "open",   index: true },

    // Contenido
    title:   { type: String },                 // opcional: título breve
    message: { type: String, required: true }, // descripción clara visible
    tags:    { type: [String], default: [] },

    // Datos de apoyo
    gps:    gpsSchema,
    meta:   { type: Schema.Types.Mixed },  // { cpCode, expectedAt, scannedAt, ... }
    source: { type: String },              // "system","job","api","client"

    // SLA (minutos objetivo)
    sla: {
      ackMinutes:   { type: Number, default: 5 },    // tiempo objetivo para reconocer
      closeMinutes: { type: Number, default: 60 },   // tiempo objetivo para cerrar
    },

    // Línea de tiempo / auditoría
    opened:  actorSchema, // quién la creó (normalmente sistema)
    acked:   actorSchema, // quién la reconoció
    closed:  actorSchema, // quién la cerró

    // Campos legacy / compat
    createdBy: { type: String }, // sub/email
    updatedBy: { type: String },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
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
 * Índices compuestos
 * ========================= */
AlertSchema.index({ siteId: 1, status: 1, createdAt: -1 });
AlertSchema.index({ kind: 1, severity: 1, createdAt: -1 });
AlertSchema.index({ guardExternalId: 1, status: 1, createdAt: -1 });

/** =========================
 * Validaciones / Hooks
 * ========================= */
AlertSchema.pre("validate", function (next) {
  if (this.severity) this.severity = toLower(this.severity);
  if (this.status)   this.status   = toLower(this.status);
  next();
});

AlertSchema.pre("save", function (next) {
  // Normaliza tags
  if (Array.isArray(this.tags)) {
    this.tags = Array.from(new Set(this.tags.map(toLower).filter(Boolean)));
  }
  next();
});

/** =========================
 * Virtuales
 * ========================= */
AlertSchema.virtual("isOpen").get(function () { return this.status === "open"; });
AlertSchema.virtual("isAck").get(function ()  { return this.status === "ack"; });
AlertSchema.virtual("isClosed").get(function () { return this.status === "closed"; });

/** =========================
 * Helpers de instancia (ciclo de vida)
 * ========================= */

/** Reconocer (ack) */
AlertSchema.methods.acknowledge = function ({ by, note } = {}) {
  if (this.status === "closed") return this;
  this.status = "ack";
  this.acked = { by, note, at: new Date() };
  return this;
};

/** Cerrar */
AlertSchema.methods.close = function ({ by, note } = {}) {
  this.status = "closed";
  this.closed = { by, note, at: new Date() };
  return this;
};

/** Reabrir */
AlertSchema.methods.reopen = function ({ by, note } = {}) {
  this.status = "open";
  // mantenemos histórico de ack/close; si quieres limpiar, puedes resetear this.closed
  return this;
};

/** Métricas de SLA */
AlertSchema.methods.slaMetrics = function () {
  const createdAt = this.createdAt ? new Date(this.createdAt) : null;
  const ackAt     = this.acked?.at ? new Date(this.acked.at) : null;
  const closeAt   = this.closed?.at ? new Date(this.closed.at) : null;

  const ackMs   = createdAt && ackAt  ? ackAt.getTime()  - createdAt.getTime() : null;
  const closeMs = createdAt && closeAt? closeAt.getTime() - createdAt.getTime() : null;

  return {
    ackMs,
    closeMs,
    ackOk:   ackMs   != null && this.sla?.ackMinutes   != null ? ackMs   <= this.sla.ackMinutes   * 60000 : null,
    closeOk: closeMs != null && this.sla?.closeMinutes != null ? closeMs <= this.sla.closeMinutes * 60000 : null,
  };
};



const Alert = model("Alert", AlertSchema);
export default Alert;
