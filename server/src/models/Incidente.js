import mongoose from "mongoose";
const IncidenteSchema = new mongoose.Schema({
  guardia: { type: mongoose.Schema.Types.ObjectId, ref: "Guardia", required:true },
  areaFisica: String,
  fecha: { type: Date, required:true },
  tipo: String,
  descripcion: String,
  evidenciaUrl: String,
  nivelRiesgo: { type:String, enum:["bajo","medio","alto","critico"], default:"bajo" },
  accionTomada: String,
  estado: { type:String, enum:["abierto","en_proceso","cerrado"], default:"abierto" },
}, { timestamps: true });
export default mongoose.model("Incidente", IncidenteSchema);