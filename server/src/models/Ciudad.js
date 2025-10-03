import mongoose from "mongoose";
const { Schema } = mongoose;

const CiudadSchema = new Schema(
  {
    codigo: { type: Number, sparse: true },
    nombreCiudadMunicipio: { type: String, required: true, trim: true },
    departamento: { type: Schema.Types.ObjectId, ref: "Departamento", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.ID_Ciudad_municipio = ret.codigo ?? ret._id;
        ret.nombre_Ciudad_municipio = ret.nombreCiudadMunicipio;
        ret.ID_Departamento = ret.departamento;
        return ret;
      },
    },
  }
);

// Única por departamento
CiudadSchema.index({ nombreCiudadMunicipio: 1, departamento: 1 }, { unique: true });

CiudadSchema.statics.fromRequest = function (b = {}) {
  const pick = (...k) => k.find((x) => b[x] !== undefined) && b[k.find((x) => b[x] !== undefined)];
  return {
    codigo: pick("codigo", "ID_Ciudad_municipio", "id_ciudad_municipio"),
    nombreCiudadMunicipio: pick("nombreCiudadMunicipio", "nombre_Ciudad_municipio", "nombre"),
    departamento: pick("departamento", "ID_Departamento", "id_departamento"),
  };
};

export default mongoose.model("Ciudad", CiudadSchema);
