import mongoose from "mongoose";
const schema = new mongoose.Schema({
  key:   { type: String, unique: true, required: true }, // "clientes.crear"
  label: { type: String, required: true },
  group: { type: String, required: true },               // Módulo (Clientes)
  order: { type: Number, default: 0 }
}, { timestamps: true });
export default mongoose.model("IamPermission", schema);
