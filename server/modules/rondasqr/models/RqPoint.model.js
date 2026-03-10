// server/modules/rondasqr/models/RqPoint.model.js
import mongoose from "mongoose";
import crypto from "crypto";

const { Schema } = mongoose;

/* ─────────────── Helpers internos para QR ─────────────── */

function randomToken(len = 8) {
  return crypto
    .randomBytes(Math.ceil(len))
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

/**
 * Construye un código QR legible para el sticker físico.
 * Ej: P05-AB29FQ
 */
function buildQrCode({ order, name }) {
  const ord = Number.isFinite(order) ? order : 0;
  const ordStr = String(ord + 1).padStart(2, "0");
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

    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    qr: { type: String, trim: true, index: true },
    qrNo: { type: String, trim: true, index: true, sparse: true },
    code: { type: String, trim: true, index: true, sparse: true },
    nfc: { type: String, trim: true },

    qrSecret: {
      type: String,
      trim: true,
      select: false,
    },

    qrVersion: {
      type: Number,
      default: 1,
    },

    qrRotatedAt: { type: Date },

    order: {
      type: Number,
      default: null,
      index: true,
    },

    window: {
      startMin: { type: Number, default: 0 },
      endMin: { type: Number, default: 0 },
    },

    active: { type: Boolean, default: true },

    loc: {
      type: {
        type: String,
        enum: ["Point"],
        default: undefined,
      },
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

    gps: {
      lat: { type: Number, default: undefined },
      lon: { type: Number, default: undefined },
    },

    notes: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "rq_points",
    versionKey: false,
    minimize: false,
  }
);

/* -------------------- Índices -------------------- */

RqPointSchema.index({ loc: "2dsphere" });
RqPointSchema.index({ active: 1 });

RqPointSchema.index(
  { siteId: 1, roundId: 1, order: 1 },
  { unique: true }
);

RqPointSchema.index(
  { roundId: 1, name: 1 },
  { unique: true }
);

RqPointSchema.index(
  { roundId: 1, qr: 1 },
  { unique: true, sparse: true }
);

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
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

/* --------------- Saneado de loc/gps --------------- */

RqPointSchema.pre("validate", function preValidate(next) {
  try {
    const hasLonLat =
      this?.loc?.coordinates &&
      Array.isArray(this.loc.coordinates) &&
      this.loc.coordinates.length === 2 &&
      this.loc.coordinates.every((n) => Number.isFinite(n));

    if (hasLonLat) {
      this.loc.type = "Point";
      const [lon, lat] = this.loc.coordinates;
      this.loc.coordinates = [Number(lon), Number(lat)];

      this.gps = this.gps || {};
      this.gps.lon = Number(lon);
      this.gps.lat = Number(lat);
    } else if (
      this?.gps &&
      Number.isFinite(this.gps.lat) &&
      Number.isFinite(this.gps.lon)
    ) {
      this.loc = {
        type: "Point",
        coordinates: [Number(this.gps.lon), Number(this.gps.lat)],
      };
    } else {
      this.loc = undefined;
    }

    if (typeof this.name === "string") {
      this.name = this.name.trim();
    }

    if (typeof this.qr === "string") this.qr = this.qr.trim();
    if (typeof this.qrNo === "string") this.qrNo = this.qrNo.trim();
    if (typeof this.code === "string") this.code = this.code.trim();

    next();
  } catch (err) {
    next(err);
  }
});

/* --------- Asignación automática de order y QR --------- */

RqPointSchema.pre("save", async function preSave(next) {
  try {
    if (this.isNew && (this.order === null || this.order === undefined)) {
      const count = await this.constructor.countDocuments({
        roundId: this.roundId,
      });
      this.order = count;
    }

    if (!Number.isFinite(this.order)) {
      this.order = 0;
    }

    if (!this.qr) {
      this.qr = buildQrCode({
        order: this.order,
        name: this.name,
      });
    }

    if (!this.qrNo) this.qrNo = this.qr;
    if (!this.code) this.code = this.qr;

    if (!this.qrSecret) {
      this.qrSecret = randomToken(24);
    }

    if (!Number.isFinite(this.qrVersion)) {
      this.qrVersion = 1;
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* --------------- Recompactado tras eliminar --------------- */

RqPointSchema.statics.compactAfterDelete = async function compactAfterDelete(
  roundId,
  deletedOrder
) {
  if (!roundId || !Number.isFinite(deletedOrder)) return;

  await this.updateMany(
    { roundId, order: { $gt: deletedOrder } },
    { $inc: { order: -1 } }
  );
};

RqPointSchema.post("findOneAndDelete", async function postDelete(doc) {
  if (doc && doc.roundId && typeof doc.order === "number") {
    await doc.constructor.compactAfterDelete(doc.roundId, doc.order);
  }
});

/* --------------- Métodos estáticos útiles para QR --------------- */

RqPointSchema.statics.rotateQr = async function rotateQr(pointId) {
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
  point.code = point.qr;

  point.qrSecret = randomToken(24);
  point.qrVersion = (point.qrVersion || 1) + 1;
  point.qrRotatedAt = new Date();

  await point.save();
  return { point, oldQr };
};

RqPointSchema.statics.ensureQrForRound = async function ensureQrForRound(roundId) {
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