// models/Area.js
import mongoose from "mongoose";
const AreaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, index: true },
  codigo: String,
  descripcion: String,
  jefe: { type: mongoose.Schema.Types.ObjectId, ref: "Empleado" },
}, { timestamps: true });
export default mongoose.model("Area", AreaSchema);