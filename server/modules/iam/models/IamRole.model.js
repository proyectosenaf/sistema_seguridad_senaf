import mongoose from "mongoose";
const schema = new mongoose.Schema({
  code:        { type: String, unique: true, index: true }, // "admin"
  name:        { type: String, required: true },            // "Administrador"
  description: { type: String },
  permissions: { type: [String], default: [] }              // keys de permisos
}, { timestamps: true });
export default mongoose.model("IamRole", schema);
