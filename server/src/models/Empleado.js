import mongoose from "mongoose";
const { Schema } = mongoose;

const EmpleadoSchema = new Schema(
  {
    persona: { type: Schema.Types.ObjectId, ref: "Persona", required: true },
    numeroEmpleado: { type: String, unique: true, sparse: true },
    departamento: { type: String },   // organizacional (no el geográfico)
    area: { type: String },
    cargo: { type: String },
    turno: { type: String, enum: ["Mañana", "Tarde", "Noche", "Rotativo"], default: "Rotativo" },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

EmpleadoSchema.index({ persona: 1 }, { unique: true });

EmpleadoSchema.statics.fromRequest = function (b = {}) {
  const pick = (...k) => k.find((x) => b[x] !== undefined) && b[k.find((x) => b[x] !== undefined)];
  return {
    persona: pick("persona", "ID_persona"),
    numeroEmpleado: pick("numeroEmpleado", "ID_empleado", "id_empleado", "codigo_empleado"),
    departamento: pick("departamento", "Departamento"),
    area: pick("area", "Área", "puesto"),
    cargo: pick("cargo", "Cargo"),
    turno: pick("turno", "Turno"),
    activo: b.activo,
  };
};

export default mongoose.model("Empleado", EmpleadoSchema);
