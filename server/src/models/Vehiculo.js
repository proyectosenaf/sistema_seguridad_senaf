// models/Vehiculo.js
import mongoose from "mongoose";
const VehiculoSchema = new mongoose.Schema({
  placa: { type:String, index:true },
  marca: String, modelo: String, color: String, tipo: String
}, { timestamps:true });
export default mongoose.model("Vehiculo", VehiculoSchema);

