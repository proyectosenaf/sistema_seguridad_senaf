import mongoose from 'mongoose';

const PuntoSchema = new mongoose.Schema({
  codigo: { type: String, required: true },  // ID/QR del punto
  nombre: { type: String, required: true },
  orden:  { type: Number, default: 0 },
  obligatorio: { type: Boolean, default: true },
});

const PlantillaRondaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  puntos: [PuntoSchema],
  activo: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('PlantillaRonda', PlantillaRondaSchema);
