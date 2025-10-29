// server/modules/rondasqr/models/RqMark.model.js
import mongoose from "mongoose";

/**
 * Modelo de marca (check-in) tolerante:
 * - Acepta tanto officer* como guard* (por compatibilidad).
 * - Guarda GPS plano (gps.lat/lon) y espejo en GeoJSON loc [lon,lat].
 * - Incluye nombres (siteName, roundName, pointName) y código del punto (pointQr).
 */

const GpsSchema = new mongoose.Schema(
  {
    lat: { type: Number, default: undefined },
    lon: { type: Number, default: undefined },
  },
  { _id: false }
);

const RqMarkSchema = new mongoose.Schema(
  {
    hardwareId: String,             // id del teléfono / dispositivo

    // Identificadores relacionales
    siteId:   { type: mongoose.Schema.Types.ObjectId, ref: "RqSite" },
    roundId:  { type: mongoose.Schema.Types.ObjectId, ref: "RqRound" },
    pointId:  { type: mongoose.Schema.Types.ObjectId, ref: "RqPoint" },

    // Etiquetas / nombres (desnormalizados para reportes rápidos)
    siteName:  String,
    roundName: String,
    pointName: String,
    pointQr:   String,              // "QR No." del sticker (si lo manejas)

    // Guardia / oficial (acepta variantes)
    officerName:  String,
    officerEmail: String,
    guardName:    String,           // compatibilidad
    guardId:      String,           // compatibilidad (sub/legajo)

    steps:    { type: Number, default: 0 },
    message:  { type: String, default: "" },
    at:       { type: Date, default: Date.now },

    // GPS simple y GeoJSON (ambos; se sincronizan en pre-save)
    gps: GpsSchema,
    loc: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }, // [lon, lat]
    },
  },
  { timestamps: true, strict: true }
);

// Índices para consultas frecuentes
RqMarkSchema.index({ at: 1 });
RqMarkSchema.index({ "gps.lat": 1, "gps.lon": 1 });
RqMarkSchema.index({ loc: "2dsphere" });
RqMarkSchema.index({ officerEmail: 1, at: -1 });
RqMarkSchema.index({ guardId: 1, at: -1 });

// Sincroniza gps <-> loc antes de guardar
RqMarkSchema.pre("save", function syncGpsToLoc(next) {
  try {
    const hasGps =
      this?.gps && typeof this.gps.lat === "number" && typeof this.gps.lon === "number";

    if (hasGps) {
      // si hay gps, garantizamos loc
      this.loc = this.loc || {};
      this.loc.type = "Point";
      this.loc.coordinates = [this.gps.lon, this.gps.lat];
    } else if (
      this?.loc?.coordinates &&
      Array.isArray(this.loc.coordinates) &&
      this.loc.coordinates.length >= 2 &&
      typeof this.loc.coordinates[0] === "number" &&
      typeof this.loc.coordinates[1] === "number"
    ) {
      // si sólo hay loc, rellenamos gps
      this.gps = this.gps || {};
      this.gps.lon = this.loc.coordinates[0];
      this.gps.lat = this.loc.coordinates[1];
    }
  } catch {}
  next();
});

export default mongoose.model("RqMark", RqMarkSchema);
