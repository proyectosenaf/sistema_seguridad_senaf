import mongoose from "mongoose";
const { Schema } = mongoose;

const InstitucionSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, index: true },
    tipo: { type: String, enum: ["publica", "privada", "otra"], default: "privada" },
    telefono: String,
    email: String,
    direccion: String,
    pais: { type: Schema.Types.ObjectId, ref: "Pais" },
    departamento: { type: Schema.Types.ObjectId, ref: "Departamento" },
    ciudad: { type: Schema.Types.ObjectId, ref: "Ciudad" },
  },
  { timestamps: true, versionKey: false }
);

// Acepta nombres legacy
InstitucionSchema.statics.fromRequest = function (b = {}) {
  const pick = (...k) => k.find((x) => b[x] !== undefined) && b[k.find((x) => b[x] !== undefined)];
  return {
    nombre: pick("nombre", "nombre_institucion", "Institución", "institucion"),
    tipo: pick("tipo", "tipo_institucion"),
    telefono: b.telefono,
    email: b.email,
    direccion: pick("direccion", "Dirección"),
    pais: pick("pais", "ID_pais"),
    departamento: pick("departamento", "ID_Departamento"),
    ciudad: pick("ciudad", "ID_Ciudad_municipio"),
  };
};

export default mongoose.model("Institucion", InstitucionSchema);
