import mongoose from "mongoose";

const EmpleadoSchema = new mongoose.Schema(
  {
    // ID Persona en frontend
    idInterno: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },

    nombreCompleto: {
      type: String,
      required: true,
      trim: true,
    },

    dni: {
      type: String,
      trim: true,
      default: "",
    },

    fechaNacimiento: {
      type: Date,
      default: null,
    },

    sexo: {
      type: String,
      trim: true,
      default: "",
    },

    direccion: {
      type: String,
      trim: true,
      default: "",
    },

    telefono: {
      type: String,
      trim: true,
      default: "",
    },

    departamento: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    cargo: {
      type: String,
      trim: true,
      default: "",
    },

    fechaIngreso: {
      type: Date,
      default: null,
    },

    // URL o path relativo tipo /uploads/acceso/archivo.jpg
    foto_empleado: {
      type: String,
      trim: true,
      default: "",
    },

    activo: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ───────────────────── Normalización ───────────────────── */

EmpleadoSchema.pre("save", function normalizeBeforeSave(next) {
  if (typeof this.idInterno === "string") {
    this.idInterno = this.idInterno.trim();
  }

  if (typeof this.nombreCompleto === "string") {
    this.nombreCompleto = this.nombreCompleto.trim();
  }

  if (typeof this.dni === "string") {
    this.dni = this.dni.trim();
  }

  if (typeof this.sexo === "string") {
    this.sexo = this.sexo.trim();
  }

  if (typeof this.direccion === "string") {
    this.direccion = this.direccion.trim();
  }

  if (typeof this.telefono === "string") {
    this.telefono = this.telefono.trim();
  }

  if (typeof this.departamento === "string") {
    this.departamento = this.departamento.trim();
  }

  if (typeof this.cargo === "string") {
    this.cargo = this.cargo.trim();
  }

  if (typeof this.foto_empleado === "string") {
    this.foto_empleado = this.foto_empleado.trim();
  }

  next();
});

/* ───────────────────── Transformación JSON ───────────────────── */

EmpleadoSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id_persona = ret.idInterno || "";
    return ret;
  },
});

EmpleadoSchema.set("toObject", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id_persona = ret.idInterno || "";
    return ret;
  },
});

export default mongoose.models.Empleado ||
  mongoose.model("Empleado", EmpleadoSchema);