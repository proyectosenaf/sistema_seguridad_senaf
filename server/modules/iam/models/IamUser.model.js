import mongoose from "mongoose";
const schema = new mongoose.Schema({
  externalId: { type: String, index: true }, // sub/JWT si aplica
  email:      { type: String, unique: true, required: true },
  name:       { type: String },
  active:     { type: Boolean, default: true },
  roles:      { type: [String], default: [] }, // nombres/códigos de rol
  perms:      { type: [String], default: [] }  // permisos directos (opcional)
}, { timestamps: true });
export default mongoose.model("IamUser", schema);
 