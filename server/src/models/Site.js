// src/models/Site.js
import mongoose from "mongoose";

const SiteSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, unique: true, sparse: true },
  address: { type: String },
  geo: { lat: Number, lng: Number },
  timezone: { type: String, default: "America/Lima" },

  // Auditoría
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

export default mongoose.model("Site", SiteSchema);
