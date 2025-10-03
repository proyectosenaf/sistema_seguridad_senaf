import mongoose from 'mongoose';

const SedeSchema = new mongoose.Schema({
  nombre:   { type: String, required: true },
  codigo:   { type: String },
  direccion:{ type: String },
  activo:   { type: Boolean, default: true },
}, { timestamps: true });

const Sede = mongoose.model('Sede', SedeSchema);

// ⬇️ Export default (ESM)
export default Sede;

// (Opcional) también puedes dejar el named para quien lo prefiera
export { Sede };
