// models/MovimientoManual.js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  fechaHora: { type: Date, required: true },
  fechaFin: { type: Date },
  noRegresa: { type: Boolean, default: false },
  tipo: { type: String, enum: ['Entrada','Salida','Permiso'], required: true },
  personaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  persona: { type: String, required: true },
  placa: { type: String },
  observacion: { type: String },
  departamento: { type: String },
}, { timestamps: true });
export default mongoose.model('MovimientoManual', schema);
