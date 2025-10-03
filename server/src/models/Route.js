// src/models/Route.js
import mongoose from "mongoose";

/** =========================
 * Utilidades / Constantes
 * ========================= */
const METHOD_ENUM = ["qr", "nfc", "finger"];
const GEOFENCE_TYPES = ["circle", "polygon"];

const isHHmm = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const normStr = (s) => (typeof s === "string" ? s.trim() : s);
const toSlug = (s) =>
  normStr(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

/** =========================
 * Sub-schemas
 * ========================= */
const GeofenceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: GEOFENCE_TYPES, required: true },
    // circle
    center: {
      lat: { type: Number },
      lng: { type: Number },
    },
    radiusMeters: { type: Number, min: 0 },
    // polygon
    points: [
      {
        lat: Number,
        lng: Number,
      },
    ],
  },
  { _id: false }
);

const CheckpointSchema = new mongoose.Schema(
  {
    code: { type: String, required: true }, // único (case-insensitive) dentro de la ruta
    name: { type: String, required: true },
    order: { type: Number, default: 0, index: true },

    allowedMethods: {
      type: [{ type: String, enum: METHOD_ENUM }],
      default: ["qr"],
    },

    geofence: GeofenceSchema,

    expectedSecondsFromStart: { type: Number, default: 0 }, // t=0 al iniciar ronda
    graceSeconds: { type: Number, default: 120 }, // tolerancia por punto

    requirePhoto: { type: Boolean, default: false },
    requireNote: { type: Boolean, default: false },

    tags: [{ type: String }],
  },
  { _id: false }
);

const WindowSchema = new mongoose.Schema(
  {
    // Días permitidos (0=Dom, 6=Sáb)
    dow: [{ type: Number, min: 0, max: 6 }],
    // Ventana de horario. Puede cruzar medianoche (p. ej., 20:00 -> 06:00)
    start: {
      type: String,
      validate: { validator: (v) => !v || isHHmm(v), message: "start debe ser HH:mm" },
    },
    end: {
      type: String,
      validate: { validator: (v) => !v || isHHmm(v), message: "end debe ser HH:mm" },
    },
    // Etiqueta opcional (turno noche, fin de semana, etc.)
    label: { type: String },
  },
  { _id: false }
);

/** =========================
 * Route Schema
 * ========================= */
const RouteSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site" },
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true, sparse: true, trim: true }, // opcional, autogenerable

    checkpoints: { type: [CheckpointSchema], default: [] },
    windows: { type: [WindowSchema], default: [] },

    sla: {
      lateThresholdSeconds: { type: Number, default: 180 },
      missingThresholdSeconds: { type: Number, default: 600 },
    },

    active: { type: Boolean, default: true },

    // Auditoría
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        // Limpieza final para respuestas JSON
        // No tocamos _id porque suele ser útil
        if (Array.isArray(ret.checkpoints)) {
          ret.checkpoints = ret.checkpoints.map((cp) => ({
            ...cp,
            // aseguro tags normalizadas a nivel de salida
            tags: Array.isArray(cp.tags)
              ? Array.from(new Set(cp.tags.map((t) => normStr(t)?.toLowerCase()).filter(Boolean)))
              : [],
          }));
        }
        return ret;
      },
    },
  }
);

/** =========================
 * Índices
 * ========================= */
RouteSchema.index({ siteId: 1, name: 1 }, { unique: true });
RouteSchema.index({ "checkpoints.code": 1 });
RouteSchema.index({ "checkpoints.order": 1 });
RouteSchema.index({ siteId: 1, active: 1 });
RouteSchema.index({ code: 1 }, { unique: true, sparse: true });

/** =========================
 * Validaciones / Normalizadores
 * ========================= */

// Unicidad de code de checkpoint dentro de la ruta (case-insensitive)
RouteSchema.pre("validate", function (next) {
  if (!Array.isArray(this.checkpoints)) return next();

  const seen = new Set();
  for (const cp of this.checkpoints) {
    const code = normStr(cp.code)?.toLowerCase();
    if (!code) continue;
    if (seen.has(code)) {
      return next(new Error(`Checkpoint code duplicado en la ruta (case-insensitive): "${cp.code}"`));
    }
    seen.add(code);
  }
  next();
});

// Validación de geofence coherente
RouteSchema.pre("validate", function (next) {
  if (!Array.isArray(this.checkpoints)) return next();

  for (const cp of this.checkpoints) {
    const gf = cp.geofence;
    if (!gf) continue;

    if (!GEOFENCE_TYPES.includes(gf.type)) {
      return next(new Error(`Geofence.type inválido en "${cp.code}"`));
    }

    if (gf.type === "circle") {
      if (
        typeof gf?.center?.lat !== "number" ||
        typeof gf?.center?.lng !== "number" ||
        typeof gf?.radiusMeters !== "number" ||
        gf.radiusMeters <= 0
      ) {
        return next(new Error(`Geofence circle inválido en "${cp.code}": requiere center(lat,lng) y radiusMeters>0`));
      }
    }

    if (gf.type === "polygon") {
      if (!Array.isArray(gf.points) || gf.points.length < 3) {
        return next(new Error(`Geofence polygon inválido en "${cp.code}": requiere al menos 3 puntos`));
      }
      for (const p of gf.points) {
        if (typeof p.lat !== "number" || typeof p.lng !== "number") {
          return next(new Error(`Geofence polygon con punto inválido en "${cp.code}" (lat/lng numéricos)`));
        }
      }
    }
  }

  next();
});

// Validación de ventanas: HH:mm válidas (ya cubierto) y DOW dentro de rango
RouteSchema.pre("validate", function (next) {
  if (!Array.isArray(this.windows)) return next();

  for (const w of this.windows) {
    if (w.dow && w.dow.some((d) => d < 0 || d > 6)) {
      return next(new Error("Window.dow contiene valores fuera de 0..6"));
    }
    if ((w.start && !isHHmm(w.start)) || (w.end && !isHHmm(w.end))) {
      return next(new Error("Window.start/end deben ser HH:mm"));
    }
    // Permite ventanas que cruzan medianoche (p.ej., 20:00 -> 06:00)
    // Si deseas obligar start != end, descomenta:
    // if (w.start && w.end && w.start === w.end) {
    //   return next(new Error("Window.start y end no deben ser iguales"));
    // }
  }
  next();
});

// Normalización: orden de checkpoints, codes/names/tags recortados y en minúscula donde aplique
RouteSchema.pre("save", function (next) {
  // Autogenerar code si no viene y hay name
  if (!this.code && this.name) {
    const base = toSlug(this.name);
    // corto y añado sufijo aleatorio para evitar colisiones
    const suffix = Math.random().toString(36).slice(2, 6);
    this.code = base ? `${base}-${suffix}` : `route-${suffix}`;
  }

  if (Array.isArray(this.checkpoints)) {
    // ordenar
    this.checkpoints.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // normalizar
    this.checkpoints = this.checkpoints.map((cp) => {
      const out = { ...cp };
      out.code = normStr(out.code);
      out.name = normStr(out.name);

      // tags en minúscula, únicos
      if (Array.isArray(out.tags)) {
        out.tags = Array.from(new Set(out.tags.map((t) => normStr(t)?.toLowerCase()).filter(Boolean)));
      }

      // métodos por defecto si viene vacío
      if (!Array.isArray(out.allowedMethods) || out.allowedMethods.length === 0) {
        out.allowedMethods = ["qr"];
      }

      // límites razonables
      if (typeof out.expectedSecondsFromStart !== "number" || out.expectedSecondsFromStart < 0) {
        out.expectedSecondsFromStart = 0;
      }
      if (typeof out.graceSeconds !== "number" || out.graceSeconds < 0) {
        out.graceSeconds = 120;
      }

      return out;
    });
  }

  // normalizar ventanas
  if (Array.isArray(this.windows)) {
    this.windows = this.windows.map((w) => ({
      ...w,
      label: normStr(w.label),
    }));
  }

  next();
});

/** =========================
 * Virtuales
 * ========================= */
RouteSchema.virtual("totalCheckpoints").get(function () {
  return Array.isArray(this.checkpoints) ? this.checkpoints.length : 0;
});

/** =========================
 * Métodos de instancia
 * ========================= */

/**
 * getCheckpointByCode: retorna el checkpoint (case-insensitive) o undefined
 */
RouteSchema.methods.getCheckpointByCode = function (code) {
  if (!Array.isArray(this.checkpoints) || !code) return undefined;
  const key = code.toLowerCase();
  return this.checkpoints.find((c) => (c.code || "").toLowerCase() === key);
};

/**
 * buildExpectedTimeline: a partir de startedAt, devuelve lista {code,name,order,expectedAt,graceUntil}
 */
RouteSchema.methods.buildExpectedTimeline = function (startedAt) {
  const t0 = startedAt ? new Date(startedAt) : new Date();
  return (this.checkpoints || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((cp) => {
      const expectedAt = new Date(t0.getTime() + (cp.expectedSecondsFromStart || 0) * 1000);
      const graceUntil = new Date(expectedAt.getTime() + (cp.graceSeconds || 0) * 1000);
      return {
        code: cp.code,
        name: cp.name,
        order: cp.order,
        expectedAt,
        graceUntil,
      };
    });
};

/**
 * isWithinAnyWindow(date): verifica si un Date cae dentro de alguna ventana declarada (considera cruces de medianoche).
 * Si no hay ventanas, retorna true (libre).
 */
RouteSchema.methods.isWithinAnyWindow = function (date = new Date()) {
  if (!Array.isArray(this.windows) || this.windows.length === 0) return true;

  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const dow = date.getDay(); // 0..6

  const toMinutes = (hh) => {
    const [h, m] = hh.split(":").map((x) => parseInt(x, 10));
    return h * 60 + m;
  };

  const now = toMinutes(hhmm);

  for (const w of this.windows) {
    // día permitido
    if (Array.isArray(w.dow) && w.dow.length > 0 && !w.dow.includes(dow)) continue;

    const s = w.start || "00:00";
    const e = w.end || "23:59";
    const ms = toMinutes(s);
    const me = toMinutes(e);

    if (ms <= me) {
      // ventana normal (mismo día)
      if (now >= ms && now <= me) return true;
    } else {
      // cruza medianoche (ej. 20:00 -> 06:00)
      if (now >= ms || now <= me) return true;
    }
  }
  return false;
};

/** =========================
 * Métodos estáticos
 * ========================= */
RouteSchema.statics.findActiveBySite = function (siteId) {
  return this.find({ siteId, active: true }).sort({ name: 1 });
};

const Route = mongoose.model("Route", RouteSchema);
export default Route;
