import mongoose from "mongoose";

const { Schema } = mongoose;

// Validaciones sencillas
const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRE = /^[\d\s()+\-]{6,20}$/;

const PersonaSchema = new Schema(
  {
    // === Campos principales (camelCase) ===
    sexo: { type: String, enum: ["M", "F", "Otro"], required: true, default: "Otro" }, // Sexo
    nombreCompleto: { type: String, required: true, trim: true, index: true },         // NombreCompleto
    dniPersona: { type: String, trim: true, unique: true, sparse: true },              // DNI_persona
    fechaNacimiento: { type: Date },                                                   // Fecha_Nacimiento
    lugarNacimiento: { type: String, trim: true },                                     // lugar_nacimiento
    direccionPersona: { type: String, trim: true },                                    // Dirección_persona
    correoPersona: {
      type: String,
      trim: true,
      lowercase: true,
      match: emailRE,
      sparse: true,
      index: true,
    },                                                                                 // Correo_Persona
    telefonoPersona: { type: String, trim: true, match: phoneRE },                     // TelefonoPersona

    // === Relaciones / FKs ===
    pais: { type: Schema.Types.ObjectId, ref: "Pais" },                                // ID_Pais
    departamento: { type: Schema.Types.ObjectId, ref: "Departamento" },                // ID_Departamento
    ciudadMunicipio: { type: Schema.Types.ObjectId, ref: "Ciudad" },                   // ID_Ciudad_municipio

    // (Opcional) tipo de persona para segmentar
    tipo: { type: String, enum: ["empleado", "visitante", "otro"], default: "otro" },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Exponer alias “legacy” si los necesitas en respuestas:
        ret.ID_persona = ret._id;
        ret.Sexo = ret.sexo;
        ret.NombreCompleto = ret.nombreCompleto;
        ret.DNI_persona = ret.dniPersona;
        ret.Fecha_Nacimiento = ret.fechaNacimiento;
        ret.lugar_nacimiento = ret.lugarNacimiento;
        ret.Direccion_persona = ret.direccionPersona; // sin tilde para evitar problemas
        ret.Correo_Persona = ret.correoPersona;
        ret.TelefonoPersona = ret.telefonoPersona;
        ret.ID_Pais = ret.pais;
        ret.ID_Departamento = ret.departamento;
        ret.ID_Ciudad_municipio = ret.ciudadMunicipio;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Índices útiles
PersonaSchema.index({ nombreCompleto: "text", dniPersona: "text" });

// Normaliza/corrige pequeños detalles antes de guardar
PersonaSchema.pre("save", function (next) {
  if (this.nombreCompleto) this.nombreCompleto = this.nombreCompleto.trim();
  if (this.dniPersona) this.dniPersona = this.dniPersona.trim();
  next();
});

/**
 * Crea un payload normalizado desde un body que puede venir
 * en camelCase o con nombres legacy (DNI_persona, ID_Pais, etc.).
 * Uso: Persona.create(Persona.fromRequest(req.body))
 */
PersonaSchema.statics.fromRequest = function fromRequest(body = {}) {
  const pick = (...keys) => {
    for (const k of keys) if (body[k] !== undefined) return body[k];
    return undefined;
  };

  return {
    sexo: pick("sexo", "Sexo"),
    nombreCompleto: pick("nombreCompleto", "NombreCompleto"),
    dniPersona: pick("dniPersona", "DNI_persona", "dni"),
    fechaNacimiento: pick("fechaNacimiento", "Fecha_Nacimiento"),
    lugarNacimiento: pick("lugarNacimiento", "lugar_nacimiento"),
    direccionPersona: pick("direccionPersona", "Direccion_persona", "Dirección_persona"),
    correoPersona: pick("correoPersona", "Correo_Persona", "email"),
    telefonoPersona: pick("telefonoPersona", "TelefonoPersona", "telefono"),
    pais: pick("pais", "ID_Pais"),
    departamento: pick("departamento", "ID_Departamento"),
    ciudadMunicipio: pick("ciudadMunicipio", "ID_Ciudad_municipio"),
    tipo: pick("tipo", "Tipo"),
  };
};

export default mongoose.model("Persona", PersonaSchema);
