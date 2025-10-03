// src/models/Scan.js
import { Schema, model } from "mongoose";

/** =========================
 * Constantes & Utils
 * ========================= */
const SCAN_RESULT = ["ok", "late", "invalid"]; // (los "missed" se deducen desde el Shift, no generan scan)
const METHODS = ["qr", "nfc", "finger", "manual"];

const haversineMeters = (a, b) => {
  if (!a || !b || typeof a.lat !== "number" || typeof a.lng !== "number" || typeof b.lat !== "number" || typeof b.lng !== "number") {
    return NaN;
  }
  const R = 6371000; // m
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Ray casting básico para polígono simple (lat,lng)
const pointInPolygon = (pt, poly = []) => {
  if (!pt || !Array.isArray(poly) || poly.length < 3) return false;
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i], pj = poly[j];
    const intersect = ((pi.lng > pt.lng) !== (pj.lng > pt.lng)) &&
      (pt.lat < (pj.lat - pi.lat) * (pt.lng - pi.lng) / (pj.lng - pi.lng + 1e-12) + pi.lat);
    if (intersect) c = !c;
  }
  return c;
};

/** =========================
 * Subesquemas
 * ========================= */
const gpsSchema = new Schema(
  { lat: Number, lng: Number, accuracy: Number },
  { _id: false }
);

const deviceSchema = new Schema(
  {
    deviceId: String,
    appVersion: String,
    platform: String, // android/ios/web
    userAgent: String,
    ip: String,
  },
  { _id: false }
);

const geofenceCheckSchema = new Schema(
  {
    type: { type: String, enum: ["circle", "polygon"] },
    // circle
    center: { lat: Number, lng: Number },
    radiusMeters: Number,
    // polygon
    points: [{ lat: Number, lng: Number }],
    // resultado
    within: Boolean,
    distanceMeters: Number, // si círculo, distancia al centro
  },
  { _id: false }
);

/** =========================
 * Scan Schema
 * ========================= */
const ScanSchema = new Schema(
  {
    // Contexto
    siteId:        { type: Schema.Types.ObjectId, ref: "Site", index: true },
    routeId:       { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    assignmentId:  { type: Schema.Types.ObjectId, ref: "RouteAssignment", index: true },
    shiftId:       { type: Schema.Types.ObjectId, ref: "RondaShift", required: true, index: true },

    // Guardia (usa uno u otro)
    guardId:         { type: Schema.Types.ObjectId, ref: "Guard", index: true },
    guardExternalId: { type: String, index: true }, // ej. Auth0 sub
    guardName:       { type: String },

    // Checkpoint
    cpCode:  { type: String, required: true, index: true },
    cpName:  { type: String },
    cpOrder: { type: Number, default: 0, index: true },

    // Tiempos
    expectedAt:  { type: Date, index: true },     // ETA calculada
    scannedAt:   { type: Date, default: Date.now, index: true }, // hora efectiva
    clientAt:    { type: Date },                  // hora que reportó el cliente (si se quiere medir drift)
    timeDriftMs: { type: Number, default: 0 },    // scannedAt - clientAt en ms (si se proporcionó)

    // Resultado & Método
    result: { type: String, enum: SCAN_RESULT, required: true, index: true }, // ok/late/invalid
    method: { type: String, enum: METHODS, default: "qr" },

    // Datos de validación
    gps:        gpsSchema,
    geofence:   geofenceCheckSchema, // snapshot del check de geocerca
    withinGeofence: { type: Boolean, default: true }, // redundancia para filtros rápidos

    // Evidencia y payload crudo
    photos: [{ url: String }],
    notes:  { type: String },
    rawPayload: { type: String }, // texto leído (QR/NFC), si aplica

    // Telemetría
    device: deviceSchema,

    // Auditoría
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, minimize: false }
);

/** =========================
 * Índices
 * ========================= */
ScanSchema.index({ routeId: 1, scannedAt: -1 });
ScanSchema.index({ shiftId: 1, scannedAt: 1 });
ScanSchema.index({ guardExternalId: 1, scannedAt: -1 });
ScanSchema.index({ cpCode: 1, scannedAt: -1 });
ScanSchema.index({ result: 1, scannedAt: -1 });
ScanSchema.index({ withinGeofence: 1, scannedAt: -1 });

ScanSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => ret,
});

/** =========================
 * Hooks / Validaciones
 * ========================= */
ScanSchema.pre("validate", function (next) {
  // Necesitamos identificar al guardia de alguna forma
  if (!this.guardId && !this.guardExternalId) {
    return next(new Error("Debe definirse guardId o guardExternalId"));
  }
  // Asegura result coherente
  if (!SCAN_RESULT.includes(this.result)) {
    return next(new Error(`result inválido: ${this.result}`));
  }
  // timeDrift
  if (this.clientAt && this.scannedAt) {
    this.timeDriftMs = this.scannedAt.getTime() - new Date(this.clientAt).getTime();
  }
  next();
});

/** =========================
 * Helpers de instancia
 * ========================= */

/**
 * applyGeofenceCheck(geofence, gps): calcula within/distance para círculo o polígono y guarda snapshot.
 * geofence: { type: "circle"|"polygon", center:{lat,lng}, radiusMeters, points:[{lat,lng},...] }
 */
ScanSchema.methods.applyGeofenceCheck = function (geofence, gps) {
  if (!geofence || !gps) {
    this.withinGeofence = true;
    this.geofence = undefined;
    return this;
  }

  const out = { type: geofence.type };

  if (geofence.type === "circle" && geofence.center && typeof geofence.radiusMeters === "number") {
    const dist = haversineMeters(gps, geofence.center);
    out.center = geofence.center;
    out.radiusMeters = geofence.radiusMeters;
    out.distanceMeters = dist;
    out.within = Number.isFinite(dist) ? dist <= geofence.radiusMeters : false;
    this.withinGeofence = !!out.within;
    this.geofence = out;
    return this;
  }

  if (geofence.type === "polygon" && Array.isArray(geofence.points) && geofence.points.length >= 3) {
    out.points = geofence.points.slice(0, 100); // límite seguridad
    out.within = pointInPolygon(gps, out.points);
    this.withinGeofence = !!out.within;
    this.geofence = out;
    return this;
  }

  // Si geofence inválido, no bloquea el escaneo; solo marca sin info
  this.withinGeofence = true;
  this.geofence = undefined;
  return this;
};

/**
 * markLateIfNeeded(lateThresholdMs)
 * Si scannedAt - expectedAt > lateThresholdMs => result = 'late' (si no es invalid)
 */
ScanSchema.methods.markLateIfNeeded = function (lateThresholdMs = 180000) {
  if (!this.expectedAt || this.result === "invalid") return this;
  const diff = this.scannedAt.getTime() - new Date(this.expectedAt).getTime();
  if (diff > lateThresholdMs) this.result = "late";
  return this;
};

/** =========================
 * Estáticos (reportes)
 * ========================= */

/**
 * countByResult({ from, to, routeId, guardExternalId })
 * Devuelve conteos por result en el rango.
 */
ScanSchema.statics.countByResult = async function ({ from, to, routeId, guardExternalId } = {}) {
  const m = this;
  const $match = {};
  if (from || to) {
    $match.scannedAt = {};
    if (from) $match.scannedAt.$gte = new Date(from);
    if (to)   $match.scannedAt.$lte = new Date(to);
  }
  if (routeId) $match.routeId = routeId;
  if (guardExternalId) $match.guardExternalId = guardExternalId;

  const agg = await m.aggregate([
    { $match },
    { $group: { _id: "$result", count: { $sum: 1 } } },
  ]);

  return SCAN_RESULT.reduce((acc, r) => {
    const found = agg.find((x) => x._id === r);
    acc[r] = found ? found.count : 0;
    return acc;
  }, {});
};

/**
 * latestByCheckpoint({ routeId, limit })
 * Últimos scans por cpCode para una ruta.
 */
ScanSchema.statics.latestByCheckpoint = function ({ routeId, limit = 100 } = {}) {
  return this.find({ routeId }).sort({ scannedAt: -1 }).limit(limit).lean();
};

const Scan = model("Scan", ScanSchema);
export default Scan;
