import mongoose from "mongoose";
const { Schema } = mongoose;

const UsuarioSchema = new Schema(
  {
    // Auth0 o el proveedor que uses
    sub:   { type: String, unique: true, sparse: true, index: true },
    nombre:{ type: String },
    email: { type: String, index: true },

    // enlace opcional a Persona
    persona: { type: Schema.Types.ObjectId, ref: "Persona" },

    // Para compatibilidad con sistemas viejos (ID_usuarios numérico)
    legacyId: { type: Number, unique: true, sparse: true },

    activo: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

UsuarioSchema.statics.fromAuth = function (payload = {}) {
  return {
    sub: payload.sub,
    nombre: payload.name || payload.nickname,
    email: payload.email,
  };
};

export default mongoose.model("Usuario", UsuarioSchema);
