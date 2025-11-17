// server/modules/acceso/models/Empleado.js
import mongoose from "mongoose";

const EmpleadoSchema = new mongoose.Schema(
  {
    idInterno: { type: String, trim: true, index: true }, // ID Persona en el front
    nombreCompleto: { type: String, required: true, trim: true },

    dni: { type: String, trim: true },
    fechaNacimiento: { type: Date, default: null },
    sexo: { type: String, trim: true },
    direccion: { type: String, trim: true },
    telefono: { type: String, trim: true },

    departamento: { type: String, trim: true },
    cargo: { type: String, trim: true },
    fechaIngreso: { type: Date, default: null },

    foto_empleado: { type: String, trim: true }, // URL/Path de la foto
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Empleado", EmpleadoSchema);
