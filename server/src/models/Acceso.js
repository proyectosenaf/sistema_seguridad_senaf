// models/Acceso.js
import mongoose from "mongoose";
const AccesoSchema = new mongoose.Schema({
  visitante: { type: mongoose.Schema.Types.ObjectId, ref: "Persona" },
  empleado:  { type: mongoose.Schema.Types.ObjectId, ref: "Empleado" },
  vehiculo:  { type: mongoose.Schema.Types.ObjectId, ref: "Vehiculo" },
  guardia:   { type: mongoose.Schema.Types.ObjectId, ref: "Guardia" },
  tipoAcceso:{ type:String, enum:["entrada","salida"], required:true },
  sistema:   { type:String, default:"SENAF" },
  resultado: { type:String, enum:["permitido","denegado","manual"], default:"permitido" },
  observaciones: String,
  fechaHora: { type: Date, default: Date.now },
}, { timestamps: true });
export default mongoose.model("Acceso", AccesoSchema);
