import mongoose from "mongoose";
const TurnoSchema = new mongoose.Schema({
  nombre: { type:String, required:true },        // "Día", "Noche", "12x12", etc.
  horaInicio: String,                             // "06:00"
  horaFin: String,                                // "18:00"
}, { timestamps:true });
export default mongoose.model("Turno", TurnoSchema);
