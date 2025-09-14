import mongoose from "mongoose";
const GuardiaSchema = new mongoose.Schema({
  empleado: { type: mongoose.Schema.Types.ObjectId, ref: "Empleado", required: true },
  turno: { type: mongoose.Schema.Types.ObjectId, ref: "Turno" },
}, { timestamps: true });
export default mongoose.model("Guardia", GuardiaSchema);