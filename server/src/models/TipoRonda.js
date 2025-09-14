import mongoose from "mongoose";
const CargoSchema = new mongoose.Schema({ nombre: { type:String, required:true } }, { timestamps:true });
export default mongoose.model("Cargo", CargoSchema);    
