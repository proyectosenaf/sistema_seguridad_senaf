// src/models/Guard.js
import mongoose from "mongoose";

const GuardSchema = new mongoose.Schema({
  // ID externo (Auth0 sub, correo o legajo) — único
  externalId: { type: String, required: true, unique: true, index: true },

  name: { type: String, required: true },
  email: { type: String, lowercase: true, index: true },
  phone: { type: String },

  // Opcional: compañía/contratista/sede
  org: { type: String },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site" },

  // Relación con credenciales (tarjetas/badges NFC)
  badges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Badge" }],

  // Dispositivos móviles asignados
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Device" }],

  // Auditoría
  createdBy: { type: String }, // sub o email de quien lo registró
  updatedBy: { type: String },
}, { timestamps: true });

GuardSchema.index({ siteId: 1, externalId: 1 });
export default mongoose.model("Guard", GuardSchema);
