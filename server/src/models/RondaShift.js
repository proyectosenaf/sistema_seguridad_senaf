// src/models/RondaShift.js
import { Schema, model } from "mongoose";

/** =========================
 * Utils / Constantes
 * ========================= */
const SCAN_STATUS = ["pending", "ok", "late", "missed", "invalid"];
const SHIFT_STATUS = ["active", "finished", "cancelled"];
const METHOD_ENUM = ["qr", "nfc", "finger", "manual"];

const now = () => new Date();

/** =========================
 * Sub-schemas
 * ========================= */
const gpsSchema = new Schema(
  {
    lat: Number,
    lng: Number,
    accuracy: Number, // metros
  },
  { _id: false }
);

const scanMetaSchema = new Schema(
  {
    method: { type: String, enum: METHOD_ENUM }, // qr/nfc/finger/manual
    deviceId: String,
    appVersion: String,
    byUserId: String, // quien ejecutó (por si hay supervisor)
    notes: String,
    photos: [{ url: String }], // si capturas evidencia
    gps: gpsSchema,
  },
  { _id: false }
);

const progressItemSchema = new Schema(
  {
    code: { type: String, required: true }, // CP-001
    name: { type: String, required: true },
    order: { type: Number, default: 0, index: true },

    expectedAt: { type: Date }, // calculado desde la ruta
    graceSeconds: { type: Number, default: 120 },

    scannedAt: { type: Date },
    status: { type: String, enum: SCAN_STATUS, default: "pending", index: true },

    // última metadata de escaneo aplicada a este checkpoint
    meta: scanMetaSchema,
  },
  { _id: false }
);

const metricsSchema = new Schema(
  {
    completedCount: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    missedCount: { type: Number, default: 0 },
    total: { type: Number, default: 0 }, // esperado
    score: { type: Number, default: 0 }, // (completed - late*0.5 - missed*1) / total * 100, por ejemplo
    durationSeconds: { type: Number, default: 0 }, // finishedAt - startedAt
  },
  { _id: false }
);

const sosEventSchema = new Schema(
  {
    at: { type: Date, default: now },
    gps: gpsSchema,
    byUserId: String,
    message: String,
  },
  { _id: false }
);

/** =========================
 * Shift Schema
 * ========================= */
const rondaShiftSchema = new Schema(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", index: true }, // opcional
    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "RouteAssignment", index: true }, // opcional, si parte de una asignación

    // Identidad guardia: usa uno u otro (o ambos si migras)
    guardId: { type: Schema.Types.ObjectId, ref: "Guard", index: true }, // opcional
    guardExternalId: { type: String, index: true }, // ej. Auth0 sub
    guardName: { type: String }, // cache para reportes

    startedAt: { type: Date, default: now, index: true },
    finishedAt: { type: Date },

    status: { type: String, enum: SHIFT_STATUS, default: "active", index: true },

    // Progreso detallado de la ronda
    progress: { type: [progressItemSchema], default: [] },
    lastScan: {
      code: String,
      name: String,
      order: Number,
      scannedAt: Date,
      status: { type: String, enum: SCAN_STATUS },
    },

    expectedCount: { type: Number, default: 0, min: 0 },
    metrics: { type: metricsSchema, default: () => ({}) },

    // Dispositivos / versión
    deviceId: String,
    appVersion: String,

    // Seguridad / señales
    sosEvents: { type: [sosEventSchema], default: [] },

    // Cancelación / cierre
    cancelReason: String,
    endedByUserId: String,
  },
  { timestamps: true }
);

/** =========================
 * Índices compuestos
 * ========================= */
rondaShiftSchema.index({ status: 1, startedAt: -1 });
rondaShiftSchema.index({ routeId: 1, startedAt: -1 });
rondaShiftSchema.index({ siteId: 1, status: 1 });
rondaShiftSchema.index({ guardExternalId: 1, status: 1 });
rondaShiftSchema.index({ assignmentId: 1, status: 1 });

rondaShiftSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => ret,
});

/** =========================
 * Validaciones & Hooks
 * ========================= */

// Requiere al menos una identificación de guardia
rondaShiftSchema.pre("validate", function (next) {
  if (!this.guardId && !this.guardExternalId) {
    return next(new Error("Debe definirse guardId o guardExternalId"));
  }
  next();
});

// Asegura coherencia de métricas y expectedCount
rondaShiftSchema.pre("save", function (next) {
  if (!Array.isArray(this.progress)) this.progress = [];

  // Orden y expectedCount
  this.progress.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  this.expectedCount = this.progress.length;

  // Recalcula métricas básicas
  const completed = this.progress.filter((p) => p.status === "ok").length;
  const late = this.progress.filter((p) => p.status === "late").length;
  const missed = this.progress.filter((p) => p.status === "missed").length;
  const invalid = this.progress.filter((p) => p.status === "invalid").length;

  this.metrics.completedCount = completed;
  this.metrics.lateCount = late;
  this.metrics.missedCount = missed;
  this.metrics.invalidCount = invalid;
  this.metrics.total = this.expectedCount;

  // Score simple: ok=1, late=0.5, missed/invalid=0
  const points = completed * 1 + late * 0.5;
  this.metrics.score =
    this.expectedCount > 0 ? Math.round((points / this.expectedCount) * 100) : 0;

  // Duración si terminó
  if (this.finishedAt) {
    this.metrics.durationSeconds = Math.max(
      0,
      Math.floor((this.finishedAt.getTime() - this.startedAt.getTime()) / 1000)
    );
  } else {
    this.metrics.durationSeconds = 0;
  }

  next();
});

/** =========================
 * Métodos de instancia (helpers)
 * ========================= */

/**
 * initFromRoute(routeDoc, { startedAt?, overrideGrace?, expectedFrom? })
 * Construye el progreso a partir de la ruta (usando route.buildExpectedTimeline si existe).
 */
rondaShiftSchema.methods.initFromRoute = function (routeDoc, opts = {}) {
  const started = opts.startedAt ? new Date(opts.startedAt) : (this.startedAt || new Date());
  let timeline = [];

  if (routeDoc?.buildExpectedTimeline) {
    timeline = routeDoc.buildExpectedTimeline(started);
  } else if (Array.isArray(routeDoc?.checkpoints)) {
    // fallback: calcula expectedAt desde expectedSecondsFromStart
    timeline = routeDoc.checkpoints
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((cp) => {
        const expectedAt = new Date(
          started.getTime() + (cp.expectedSecondsFromStart || 0) * 1000
        );
        const graceUntil = new Date(
          expectedAt.getTime() + (cp.graceSeconds || 120) * 1000
        );
        return {
          code: cp.code,
          name: cp.name,
          order: cp.order,
          expectedAt,
          graceUntil,
          graceSeconds: cp.graceSeconds || 120,
        };
      });
  }

  this.progress = timeline.map((t) => ({
    code: t.code,
    name: t.name,
    order: t.order,
    expectedAt: t.expectedAt,
    graceSeconds: opts.overrideGrace ?? t.graceSeconds ?? 120,
    status: "pending",
  }));

  this.expectedCount = this.progress.length;
  return this;
};

/**
 * isCheckpointOverdue(p, at = new Date(), lateThresholdMs)
 * Decide tardanza en base a expectedAt + lateThresholdMs (o graceSeconds si prefieres).
 */
rondaShiftSchema.methods.isCheckpointOverdue = function (p, at = new Date(), lateThresholdMs) {
  if (!p?.expectedAt) return false;
  const threshold =
    typeof lateThresholdMs === "number"
      ? lateThresholdMs
      : (p.graceSeconds || 120) * 1000;
  return at.getTime() - new Date(p.expectedAt).getTime() > threshold;
};

/**
 * registerScan({ cpCode, at?, meta?, lateThresholdMs? })
 * Actualiza progreso según el escaneo y devuelve { status, progressItem }.
 */
rondaShiftSchema.methods.registerScan = function ({ cpCode, at, meta, lateThresholdMs }) {
  if (this.status !== "active") {
    throw new Error("El shift no está activo");
  }
  const when = at ? new Date(at) : new Date();

  const idx = this.progress.findIndex((p) => p.code === cpCode);
  if (idx === -1) {
    // checkpoint no pertenece a la ruta del shift
    // puedes contar como invalid scan global o ignorarlo
    return { status: "invalid", progressItem: null };
  }

  const p = this.progress[idx];
  if (p.scannedAt) {
    // ya escaneado -> podrías decidir ignorar o sobreescribir
    return { status: p.status, progressItem: p };
  }

  const late = this.isCheckpointOverdue(p, when, lateThresholdMs);
  p.scannedAt = when;
  p.status = late ? "late" : "ok";
  p.meta = meta || p.meta;

  this.lastScan = {
    code: p.code,
    name: p.name,
    order: p.order,
    scannedAt: when,
    status: p.status,
  };

  return { status: p.status, progressItem: p };
};

/**
 * markMissedPending({ missingThresholdMs? })
 * Marca como "missed" los checkpoints pendientes cuyo expectedAt + missingThresholdMs ya pasó.
 * Devuelve cantidad marcada.
 */
rondaShiftSchema.methods.markMissedPending = function ({ missingThresholdMs = 10 * 60 * 1000 } = {}) {
  if (!Array.isArray(this.progress) || this.progress.length === 0) return 0;
  const at = new Date();
  let count = 0;
  this.progress.forEach((p) => {
    if (!p.scannedAt && p.expectedAt) {
      const late = at.getTime() - new Date(p.expectedAt).getTime() > missingThresholdMs;
      if (late) {
        p.status = "missed";
        count += 1;
      }
    }
  });
  return count;
};

/**
 * finish({ missingThresholdMs?, endedByUserId?, reason? })
 * Marca el shift como finalizado, calcula métricas y duración.
 */
rondaShiftSchema.methods.finish = function ({ missingThresholdMs, endedByUserId, reason } = {}) {
  if (this.status !== "active") return this;

  // Marca pendientes como missed según umbral
  if (typeof missingThresholdMs === "number") {
    this.markMissedPending({ missingThresholdMs });
  }

  this.status = "finished";
  this.finishedAt = new Date();
  this.endedByUserId = endedByUserId || this.endedByUserId;
  this.cancelReason = reason || this.cancelReason; // opcional

  return this;
};

/**
 * cancel({ reason, endedByUserId })
 * Cancela el shift sin marcar pendientes como missed.
 */
rondaShiftSchema.methods.cancel = function ({ reason, endedByUserId } = {}) {
  if (this.status !== "active") return this;
  this.status = "cancelled";
  this.finishedAt = new Date();
  this.cancelReason = reason;
  this.endedByUserId = endedByUserId;
  return this;
};

/**
 * nextPending(): retorna el siguiente checkpoint pendiente por orden.
 */
rondaShiftSchema.methods.nextPending = function () {
  return (this.progress || []).find((p) => p.status === "pending") || null;
};

/**
 * addSos({ gps, byUserId, message })
 */
rondaShiftSchema.methods.addSos = function ({ gps, byUserId, message } = {}) {
  this.sosEvents.push({ at: new Date(), gps, byUserId, message });
  return this;
};

/** =========================
 * Métodos estáticos
 * ========================= */

/**
 * findActiveForGuard({ guardId, guardExternalId, siteId })
 */
rondaShiftSchema.statics.findActiveForGuard = function ({ guardId, guardExternalId, siteId } = {}) {
  const q = { status: "active" };
  if (guardId) q.guardId = guardId;
  if (guardExternalId) q.guardExternalId = guardExternalId;
  if (siteId) q.siteId = siteId;
  return this.find(q).sort({ startedAt: -1 });
};

/**
 * findInProgressByRoute(routeId)
 */
rondaShiftSchema.statics.findInProgressByRoute = function (routeId) {
  return this.find({ routeId, status: "active" }).sort({ startedAt: -1 });
};

const RondaShift = model("RondaShift", rondaShiftSchema);
export default RondaShift;
