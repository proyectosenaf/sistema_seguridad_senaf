// src/models/RouteAssignment.js
import { Schema, model } from "mongoose";

/** =========================
 * Utils
 * ========================= */
const isHHmm = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const normArrUniqueSorted = (arr = []) =>
  Array.from(new Set(arr.filter((n) => Number.isInteger(n)).map(Number))).sort((a, b) => a - b);

/** Convierte HH:mm a minutos desde 00:00 */
const toMinutes = (hhmm = "00:00") => {
  const [h, m] = (hhmm || "00:00").split(":").map((x) => parseInt(x, 10));
  return (h * 60) + (m || 0);
};

/** Devuelve true si 'nowMin' cae en la ventana [startMin, endMin], manejando cruce de medianoche */
const inWindow = (nowMin, startMin, endMin) =>
  startMin <= endMin ? (nowMin >= startMin && nowMin <= endMin)
                     : (nowMin >= startMin || nowMin <= endMin);

/** =========================
 * Schema
 * ========================= */
const RouteAssignmentSchema = new Schema(
  {
    siteId:  { type: Schema.Types.ObjectId, ref: "Site", index: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },

    // Según tu diseño anterior usabas Auth0 "sub" string; aquí mantengo ObjectId->Guard.
    // Si quieres usar sub string, cambia a { type: String, index: true } y ajusta referencias.
    guardId: { type: Schema.Types.ObjectId, ref: "Guard", required: true, index: true },
    guardName: { type: String }, // opcional para cachear nombre visible

    /** Calendario / Horario */
    // 0=Dom .. 6=Sáb
    daysOfWeek: {
      type: [Number],
      default: [0,1,2,3,4,5,6],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every((d) => d >= 0 && d <= 6),
        message: "daysOfWeek debe contener enteros en 0..6",
      },
    },

    // Hora local del sitio (HH:mm). Permite ventanas que crucen medianoche (ej. 20:00→06:00)
    startTime: {
      type: String,
      default: "00:00",
      validate: { validator: (v) => isHHmm(v), message: "startTime debe ser HH:mm" },
    },
    endTime: {
      type: String,
      default: "23:59",
      validate: { validator: (v) => isHHmm(v), message: "endTime debe ser HH:mm" },
    },

    // Recomendación/frecuencia objetivo de ejecución (minutos). 0 = sin sugerencia.
    frequencyMinutes: { type: Number, default: 0, min: 0 },

    // Vigencia (permite programaciones por temporada)
    activeFrom: { type: Date }, // si no se define, ya está activo desde siempre
    activeTo:   { type: Date }, // si se define, deja de estar activo después de esta fecha (exclusivo)

    // Excepciones: días a saltar (UTC a medianoche del sitio) y overrides de horario por fecha
    skipDates: [{ type: String }], // "YYYY-MM-DD" (zona del sitio); útil para feriados
    overrideDates: [
      new Schema(
        {
          date: { type: String, required: true }, // "YYYY-MM-DD" (zona del sitio)
          startTime: { type: String, validate: { validator: (v) => !v || isHHmm(v), message: "override start HH:mm" } },
          endTime:   { type: String, validate: { validator: (v) => !v || isHHmm(v), message: "override end HH:mm" } },
        },
        { _id: false }
      ),
    ],

    // Zona horaria del sitio (IANA) para interpretar HH:mm correctamente si luego quieres expandir a DateTime locales
    timezone: { type: String, default: "America/Tegucigalpa" },

    // Estado y auditoría
    active:    { type: Boolean, default: true, index: true },
    createdBy: { type: String },
    updatedBy: { type: String },
    notes:     { type: String }, // anotaciones del admin
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => ret,
    },
  }
);

/** =========================
 * Índices
 * ========================= */
// Búsquedas frecuentes
RouteAssignmentSchema.index({ siteId: 1, routeId: 1, active: 1 });
RouteAssignmentSchema.index({ siteId: 1, guardId: 1, active: 1 });
// Para filtrar por ventana (no exacto, pero ayuda)
RouteAssignmentSchema.index({ startTime: 1, endTime: 1 });

/** =========================
 * Normalizaciones
 * ========================= */
RouteAssignmentSchema.pre("save", function (next) {
  // Normaliza y ordena días de la semana
  this.daysOfWeek = normArrUniqueSorted(this.daysOfWeek);

  // Asegura límites válidos
  if (typeof this.frequencyMinutes !== "number" || this.frequencyMinutes < 0) {
    this.frequencyMinutes = 0;
  }

  next();
});

/** =========================
 * Virtuales
 * ========================= */
RouteAssignmentSchema.virtual("window").get(function () {
  return { startTime: this.startTime, endTime: this.endTime };
});

/** =========================
 * Helpers de instancia
 * ========================= */

/**
 * isWithinDateRange(date: Date): respeta activeFrom/activeTo
 * activeTo se interpreta como inclusivo al día (23:59:59). Ajusta según tu regla.
 */
RouteAssignmentSchema.methods.isWithinDateRange = function (date = new Date()) {
  if (this.activeFrom && date < this.activeFrom) return false;
  if (this.activeTo && date > this.activeTo) return false;
  return true;
};

/**
 * isSkipped(date: Date, localDateStr: "YYYY-MM-DD" opcional):
 * true si la fecha aparece en skipDates.
 */
RouteAssignmentSchema.methods.isSkipped = function (date = new Date(), localDateStr) {
  if (!Array.isArray(this.skipDates) || this.skipDates.length === 0) return false;
  const iso = localDateStr || date.toISOString().slice(0, 10); // si aún no mapeas TZ, esto es aproximado
  return this.skipDates.includes(iso);
};

/**
 * getOverrideFor(date): retorna un override {startTime, endTime} si existe para la fecha.
 */
RouteAssignmentSchema.methods.getOverrideFor = function (date = new Date(), localDateStr) {
  if (!Array.isArray(this.overrideDates) || this.overrideDates.length === 0) return null;
  const iso = localDateStr || date.toISOString().slice(0, 10);
  return this.overrideDates.find((o) => o.date === iso) || null;
};

/**
 * isPlannedToday(date): considera daysOfWeek + vigencia + skips.
 * NOTA: no valida la hora, solo el día planificado.
 */
RouteAssignmentSchema.methods.isPlannedToday = function (date = new Date()) {
  if (!this.active) return false;
  if (!this.isWithinDateRange(date)) return false;
  if (this.isSkipped(date)) return false;

  const dow = date.getDay(); // 0..6
  return this.daysOfWeek.includes(dow);
};

/**
 * isInTimeWindow(date): verifica si 'date' (hora) cae dentro de la ventana del día,
 * usando override si existe. Maneja cruce de medianoche.
 */
RouteAssignmentSchema.methods.isInTimeWindow = function (date = new Date()) {
  const override = this.getOverrideFor(date);
  const s = (override?.startTime) || this.startTime || "00:00";
  const e = (override?.endTime)   || this.endTime   || "23:59";

  const nowMin = date.getHours() * 60 + date.getMinutes();
  return inWindow(nowMin, toMinutes(s), toMinutes(e));
};

/**
 * shouldWorkNow(date): combinación de día planificado + hora en ventana + flags de estado.
 */
RouteAssignmentSchema.methods.shouldWorkNow = function (date = new Date()) {
  if (!this.active) return false;
  if (!this.isPlannedToday(date)) return false;
  return this.isInTimeWindow(date);
};

/**
 * conflictsWith(other): verificación simple de solape lógico de ventanas (mismo guardia+sitio+días).
 * No cubre TZ de forma avanzada; útil para checks rápidos desde el controlador.
 */
RouteAssignmentSchema.methods.conflictsWith = function (other) {
  if (!other) return false;
  // mismo guardia y sitio y días en común
  const sameGuard = String(this.guardId) === String(other.guardId);
  const sameSite = String(this.siteId || "") === String(other.siteId || "");
  if (!sameGuard || !sameSite) return false;

  const daysOverlap = (this.daysOfWeek || []).some((d) => (other.daysOfWeek || []).includes(d));
  if (!daysOverlap) return false;

  const thisS = toMinutes(this.startTime), thisE = toMinutes(this.endTime);
  const otherS = toMinutes(other.startTime), otherE = toMinutes(other.endTime);

  // si alguna cruza medianoche, el análisis exacto es más complejo; aproximamos:
  const thisCross = thisS > thisE;
  const otherCross = otherS > otherE;

  if (!thisCross && !otherCross) {
    // ventanas normales
    const overlap = !(thisE < otherS || otherE < thisS);
    return overlap;
  }

  // Fallback: si alguna cruza medianoche, aproximamos como si abarcaran todo el rango nocturno
  const normSegments = (s, e) =>
    s <= e ? [[s, e]] : [[s, 24 * 60 - 1], [0, e]];

  const A = normSegments(thisS, thisE);
  const B = normSegments(otherS, otherE);

  const segOverlap = A.some(([as, ae]) => B.some(([bs, be]) => !(ae < bs || be < as)));
  return segOverlap;
};

/** =========================
 * Métodos estáticos
 * ========================= */

/**
 * findActiveForGuard(guardId, { siteId, at }): lista de asignaciones activas y vigentes para un guardia.
 */
RouteAssignmentSchema.statics.findActiveForGuard = function (guardId, { siteId, at } = {}) {
  const q = { guardId, active: true };
  if (siteId) q.siteId = siteId;
  // Filtro de vigencia aproximado (luego la instancia valida exacto)
  if (at) {
    q.$and = [
      { $or: [{ activeFrom: null }, { activeFrom: { $lte: at } }] },
      { $or: [{ activeTo: null },   { activeTo:   { $gte: at } }] },
    ];
  }
  return this.find(q).sort({ createdAt: -1 });
};

const RouteAssignment = model("RouteAssignment", RouteAssignmentSchema);
export default RouteAssignment;
