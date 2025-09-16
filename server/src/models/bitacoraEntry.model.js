// server/src/models/bitacoraEntry.model.js
import mongoose from "mongoose";

const BitacoraEntry = new mongoose.Schema({
  ts:       { type: Date, default: Date.now, index: true },     // timestamp
  level:    { type: String, enum: ["info","warn","error","audit"], default: "info", index: true },
  modulo:   { type: String, required: true, index: true },      // "incidentes", "rondas", "auth", etc.
  accion:   { type: String, required: true },                   // "create","update","login","email_in","webhook"
  mensaje:  { type: String, required: true },                   // texto corto visible
  usuario:  { type: String },                                   // sub o email (si aplica)
  origenIp: { type: String },
  tags:     [{ type: String, index: true }],                    // p.ej. ["id:64f...","prioridad:alta"]
  meta:     { type: Object },                                   // payload adicional (no sensible)
}, { timestamps: true });

BitacoraEntry.index({ mensaje: "text", accion: "text", modulo: "text", tags: "text" });

export default mongoose.model("BitacoraEntry", BitacoraEntry);
