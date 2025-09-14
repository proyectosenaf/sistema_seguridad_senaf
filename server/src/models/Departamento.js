import mongoose from "mongoose";
const { Schema } = mongoose;

const DepartamentoSchema = new Schema(
  {
    codigo: { type: Number, sparse: true },
    nombreDepartamento: { type: String, required: true, trim: true },
    pais: { type: Schema.Types.ObjectId, ref: "Pais", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.ID_Departamento = ret.codigo ?? ret._id;
        ret.nombre_Departamento = ret.nombreDepartamento;
        ret.ID_pais = ret.pais;
        return ret;
      },
    },
  }
);

// Único por país (no puede repetirse el nombre en el mismo país)
DepartamentoSchema.index({ nombreDepartamento: 1, pais: 1 }, { unique: true });

DepartamentoSchema.statics.fromRequest = function (b = {}) {
  const pick = (...k) => k.find((x) => b[x] !== undefined) && b[k.find((x) => b[x] !== undefined)];
  return {
    codigo: pick("codigo", "ID_Departamento", "id_departamento"),
    nombreDepartamento: pick("nombreDepartamento", "nombre_Departamento", "nombre"),
    pais: pick("pais", "ID_pais", "id_pais"),
  };
};

export default mongoose.model("Departamento", DepartamentoSchema);
