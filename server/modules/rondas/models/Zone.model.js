import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  description: String,
},{ timestamps:true, collection:"senafRondas_zones" });
export default mongoose.model("RondasZone", schema);
