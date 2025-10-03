// src/models/Badge.js
import mongoose from "mongoose";

const BadgeSchema = new mongoose.Schema({
  type: { type: String, enum: ["rfid", "nfc", "qr"], required: true },
  uid: { type: String, required: true, unique: true, index: true }, // UID chip / QR

  guardId: { type: mongoose.Schema.Types.ObjectId, ref: "Guard" },

  // Estado
  active: { type: Boolean, default: true },
  blockedReason: { type: String },

  // Auditoría
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: String },
  revokedAt: { type: Date },
  revokedBy: { type: String },
}, { timestamps: true });

export default mongoose.model("Badge", BadgeSchema);
