import mongoose from "mongoose";
const BitacoraSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  detalle: { type: String, required: true, trim: true },
  categoria: { type: String, enum: ["operativo","tecnico","otros"], default: "operativo" },
  fechaHora: { type: Date, default: Date.now },
  autor: { sub: String, name: String, email: String },
}, { timestamps: true });
export default mongoose.model("Bitacora", BitacoraSchema);
// export const Bitacora = mongoose.model('Bitacora', BitacoraSchema);  