// models/Ronda.js
import mongoose from "mongoose";
const PuntoSchema = new mongoose.Schema({
  nombre: String, // “P1 Portón Norte”
  geo: { lat:Number, lng:Number },
  obligatorio: { type:Boolean, default:true },
  hora: String
}, { _id:false });

const RondaSchema = new mongoose.Schema({
  guardia:   { type: mongoose.Schema.Types.ObjectId, ref: "Guardia", required:true },
  tipo:      { type: mongoose.Schema.Types.ObjectId, ref: "TipoRonda" },
  fecha:     { type: Date, required:true },
  horaInicio:String,
  horaFin:   String,
  puntos:    [PuntoSchema],                    // plantilla asignada
  marcados:  [{ nombre:String, fechaHora:Date, ok:Boolean, nota:String }], // ejecución real
  resultado: { type:String, enum:["ok","observaciones","alerta"], default:"ok" },
  estado:    { type:String, enum:["abierta","en_proceso","cerrada"], default:"abierta" },
  observaciones: String
}, { timestamps:true });
export default mongoose.model("Ronda", RondaSchema);