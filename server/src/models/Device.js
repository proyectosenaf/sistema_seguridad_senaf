// src/models/Device.js
import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema({
  type: { type: String, enum: ["mobile", "fixed-reader", "kiosk"], required: true },
  platform: { type: String, enum: ["android", "ios", "linux", "windows", "other"], default: "android" },
  vendor: { type: String },          // fabricante
  model: { type: String },
  serial: { type: String, index: true },
  fingerprintSdk: { type: String },  // nombre/versión SDK biométrico

  // Identidad de app
  appVersion: { type: String },
  lastSeenAt: { type: Date },
  lastSeenIp: { type: String },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site" },

  // Emplazamiento (para lectores fijos)
  location: {
    name: { type: String },
    geo: { lat: Number, lng: Number },     // opcional
  },

  // Auditoría
  registeredBy: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true });

DeviceSchema.index({ siteId: 1, serial: 1 });
export default mongoose.model("Device", DeviceSchema);
