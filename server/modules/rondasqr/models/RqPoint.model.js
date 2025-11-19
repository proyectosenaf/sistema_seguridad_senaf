// server/modules/rondasqr/models/RqPoint.model.js
import mongoose from "mongoose";
import crypto from "crypto";

const { Schema } = mongoose;

/* ─────────────── Helpers internos para QR ─────────────── */

function randomToken(len = 8) {
  // base64url → quitamos cualquier cosa rara
  return crypto
    .randomBytes(Math.ceil(len))
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

/**
 * Construye un código QR legible para el sticker físico.
 * No depende de secretos, solo es identificador del punto.
 * Ej: P05-AB29FQ
 */
function buildQrCode({ order, name }) {
  const ord = Number.isFinite(order) ? order : 0;
  const ordStr = String(ord + 1).padStart(2, "0");
  // opcional: usar inicial del nombre para hacerlo un poco más “humano”
  const initial = String(name || "P").trim().charAt(0).toUpperCase() || "P";
  const token = randomToken(6);
  return `${initial}${ordStr}-${token}`;
}

const RqPointSchema = new Schema(
  {
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "RqSite",
      required: true,
      index: true,
    },
    roundId: {
      type: Schema.Types.ObjectId,
      ref: "RqRound",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true, index: true },

    // Identificadores que usamos en las rutas:
    // qr  → código impreso en el sticker (lo que escanea el guardia)
    // qrNo / code → alias usados en flujos legacy / offline
    qr: { type: String, trim: true, index: true }, // QR físico
    qrNo: { type: String, trim: true, index: true, sparse: true }, // algunos flujos lo llaman así
    code: { type: String, trim: true, index: true, sparse: true }, // usado en offline/dump
    nfc: { type: String, trim: true }, // opcional

    // 🔐 Secret interno para validar / rotar QR sin romper marcas viejas
    qrSecret: {
      type: String,
      trim: true,
      select: false, // no lo mandamos al cliente
    },
    qrVersion: {
      type: Number,
      default: 1,
    },
    qrRotatedAt: { type: Date },

    // Orden secuencial dentro de la ronda (0,1,2…)
    order: { type: Number, default: null, index: true },

    // Ventana de tolerancia (minutos)
    window: {
      startMin: { type: Number, default: 0 },
      endMin: { type: Number, default: 0 },
    },

    // Estado
    active: { type: Boolean, default: true },

    // GeoJSON opcional (solo si hay coords válidas)
    loc: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: {
        type: [Number], // [lon, lat]
        validate: {
          validator(v) {
            return (
              v == null ||
              (Array.isArray(v) &&
                v.length === 2 &&
                v.every((n) => Number.isFinite(n)))
            );
          },
          message: "loc.coordinates debe ser [lon, lat]",
        },
        default: undefined,
      },
    },

    // Coordenadas simples (compatibilidad)
    gps: { lat: Number, lon: Number },

    // Notas
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "rq_points" }
);

/* -------------------- Índices -------------------- */
RqPointSchema.index({ loc: "2dsphere" });

// un punto por ronda+posición
RqPointSchema.index(
  { siteId: 1, roundId: 1, order: 1 },
  { unique: true }
);

// búsquedas rápidas
RqPointSchema.index({ active: 1 });

// evitar duplicar QR dentro de la misma ronda
RqPointSchema.index(
  { roundId: 1, qr: 1 },
  { unique: true, sparse: true }
);

// lo mismo para qrNo y code por si los usas
RqPointSchema.index(
  { roundId: 1, qrNo: 1 },
  { unique: true, sparse: true }
);
RqPointSchema.index(
  { roundId: 1, code: 1 },
  { unique: true, sparse: true }
);

/* ----------------- Normalización JSON ----------------- */
RqPointSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/* --------------- Saneado de loc --------------- */
RqPointSchema.pre("validate", function (next) {
  const hasLonLat =
    this?.loc?.coordinates &&
    Array.isArray(this.loc.coordinates) &&
    this.loc.coordinates.length === 2 &&
    this.loc.coordinates.every((n) => Number.isFinite(n));

  if (hasLonLat) {
    this.loc.type = "Point";
    const [lon, lat] = this.loc.coordinates;
    this.loc.coordinates = [Number(lon), Number(lat)];
  } else {
    // si no vino bien, no guardamos loc
    this.loc = undefined;
  }
  next();
});

/* --------- Asignación automática de 'order' y QR (0..N) --------- */
RqPointSchema.pre("save", async function (next) {
  try {
    // 1) order correlativo si es nuevo
    if (this.isNew && (this.order === null || this.order === undefined)) {
      const count = await this.constructor.countDocuments({
        roundId: this.roundId,
      });
      this.order = count; // siguiente correlativo
    }

    // 2) QR generado automáticamente si no se envió
    if (!this.qr) {
      this.qr = buildQrCode({
        order: this.order,
        name: this.name,
      });
    }

    // 3) qrNo / code se rellenan si están vacíos
    if (!this.qrNo) this.qrNo = this.qr;
    if (!this.code) this.code = this.qr;

    // 4) Secret interno para validar/rotar
    if (!this.qrSecret) {
      this.qrSecret = randomToken(24);
    }

    // Normalización de version
    if (!Number.isFinite(this.qrVersion)) {
      this.qrVersion = 1;
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* --------------- Recompactado tras eliminar --------------- */
RqPointSchema.statics.compactAfterDelete = async function (
  roundId,
  deletedOrder
) {
  await this.updateMany(
    { roundId, order: { $gt: deletedOrder } },
    { $inc: { order: -1 } }
  );
};

// se activa con findOneAndDelete / findByIdAndDelete
RqPointSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.roundId && typeof doc.order === "number") {
    await doc.constructor.compactAfterDelete(doc.roundId, doc.order);
  }
});

/* --------------- Métodos estáticos útiles para QR --------------- */

/**
 * Rota el código QR del punto (para cambiar stickers cada X meses).
 * No borra marcas antiguas; ellas quedan con el pointQr que tenían.
 */
RqPointSchema.statics.rotateQr = async function (pointId) {
  const point = await this.findById(pointId);
  if (!point) {
    const e = new Error("Punto no encontrado");
    e.status = 404;
    throw e;
  }

  const oldQr = point.qr;

  point.qr = buildQrCode({
    order: point.order,
    name: point.name,
  });
  point.qrNo = point.qr;
  // code solo lo sobrescribimos si estaba vacío
  if (!point.code) point.code = point.qr;

  point.qrSecret = randomToken(24);
  point.qrVersion = (point.qrVersion || 1) + 1;
  point.qrRotatedAt = new Date();

  await point.save();
  return { point, oldQr };
};

/**
 * Asegura que todos los puntos de una ronda tengan QR asignado.
 * Útil para comandos de mantenimiento / migraciones.
 */
RqPointSchema.statics.ensureQrForRound = async function (roundId) {
  const points = await this.find({ roundId });
  let updated = 0;

  for (const p of points) {
    let changed = false;

    if (!p.qr) {
      p.qr = buildQrCode({ order: p.order, name: p.name });
      changed = true;
    }
    if (!p.qrNo) {
      p.qrNo = p.qr;
      changed = true;
    }
    if (!p.code) {
      p.code = p.qr;
      changed = true;
    }
    if (!p.qrSecret) {
      p.qrSecret = randomToken(24);
      changed = true;
    }
    if (!Number.isFinite(p.qrVersion)) {
      p.qrVersion = 1;
      changed = true;
    }

    if (changed) {
      await p.save();
      updated += 1;
    }
  }

  return { count: points.length, updated };
};

/* --------------- Registro del modelo --------------- */
const RqPoint =
  mongoose.models.RqPoint || mongoose.model("RqPoint", RqPointSchema);

export default RqPoint;
