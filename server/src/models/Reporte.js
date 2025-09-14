import mongoose from 'mongoose';


const reporteSchema = new mongoose.Schema({
nombre: { type: String, required: true },
descripcion: { type: String },
tipo: { type: String, enum: ['incidentes','accesos','visitas','rondas','bitacora','evaluacion','otro'], default: 'otro' },
rango: { desde: Date, hasta: Date },
filtros: { type: Object },
generadoPor: { type: String },
creadoPor: { type: String, required: true },
}, { timestamps: true });


reporteSchema.index({ nombre: 'text', descripcion: 'text', tipo: 1 });


export default mongoose.model('Reporte', reporteSchema);