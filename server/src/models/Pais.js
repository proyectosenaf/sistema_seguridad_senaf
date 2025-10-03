import mongoose from "mongoose";
const { Schema } = mongoose;

const PaisSchema = new Schema(
  {
    // opcional: código numérico si antes usabas ID_pais como entero
    codigo: { type: Number, unique: true, sparse: true },
    nombrePais: { type: String, required: true, trim: true, unique: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.ID_pais = ret.codigo ?? ret._id; // compatibilidad
        ret.nombre_pais = ret.nombrePais;
        return ret;
      },
    },
  }
);

PaisSchema.statics.fromRequest = function (b = {}) {
  const pick = (...k) => k.find((x) => b[x] !== undefined) && b[k.find((x) => b[x] !== undefined)];
  return {
    codigo: pick("codigo", "ID_pais", "id_pais"),
    nombrePais: pick("nombrePais", "nombre_pais", "nombre"),
  };
};

export default mongoose.model("Pais", PaisSchema);
