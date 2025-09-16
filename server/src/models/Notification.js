import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  mensaje: { type: String, required: true },
  leido: { type: Boolean, default: false },
  usuario: { type: String }, // puedes ajustar según tu esquema
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
