import mongoose from "mongoose";

const CheckpointSchema = new mongoose.Schema({
  code: { type: String, required: true },           // código corto, pegatina QR/NFC
  name: { type: String, required: true },
  order: { type: Number, default: 0, index: true }, // orden sugerido
  lat: Number,
  lng: Number,
  nfcUid: String,                                    // UID de tarjeta asociada al punto (opcional)
  active: { type: Boolean, default: true }
}, { _id: true });

const RondaRoute = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  checkpoints: [CheckpointSchema],
  toleranceMin: { type: Number, default: 10 },       // tolerancia entre puntos (minutos)
  expectedMinutes: { type: Number, default: 60 },
  createdBy: String
}, { timestamps: true });

export default mongoose.model("RondaRoute", RondaRoute);
