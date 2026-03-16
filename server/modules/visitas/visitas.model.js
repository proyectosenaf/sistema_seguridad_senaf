import mongoose from "mongoose";

/* Subdocumento para el vehículo del visitante */
const VehiculoVisitanteSchema = new mongoose.Schema(
  {
    marca: { type: String, trim: true, default: "" },
    modelo: { type: String, trim: true, default: "" },
    placa: { type: String, trim: true, uppercase: true, default: "" },
  },
  { _id: false }
);

const ESTADOS_VISITA = [
  "Programada",
  "En revisión",
  "Autorizada",
  "Denegada",
  "Dentro",
  "Finalizada",
  "Cancelada",
];

const TIPOS_VISITA = ["Ingreso", "Agendada"];

function normalizeEstado(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw] || value;
}

const VisitaSchema = new mongoose.Schema(
  {
    /* Datos base */
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    documento: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    empresa: {
      type: String,
      default: null,
      trim: true,
    },

    empleado: {
      type: String,
      default: null,
      trim: true,
    },

    motivo: {
      type: String,
      required: true,
      trim: true,
    },

    telefono: {
      type: String,
      default: null,
      trim: true,
    },

    correo: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Correo no válido",
      },
    },

    /* Tipo y estado */
    tipo: {
      type: String,
      enum: TIPOS_VISITA,
      default: "Ingreso",
      index: true,
    },

    estado: {
      type: String,
      enum: ESTADOS_VISITA,
      default: function () {
        return this.tipo === "Agendada" ? "Programada" : "Dentro";
      },
      index: true,
    },

    /* Vehículo del visitante */
    llegoEnVehiculo: {
      type: Boolean,
      default: false,
    },

    vehiculo: {
      type: VehiculoVisitanteSchema,
      default: null,
    },

    /* QR de cita */
    qrToken: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },

    qrPayload: {
      type: String,
      default: null,
      trim: true,
    },

    /* Auditoría de escaneo / validación */
    validatedAt: {
      type: Date,
      default: null,
    },

    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* Auditoría de ingreso */
    ingresadaAt: {
      type: Date,
      default: null,
    },

    ingresadaBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* Fechas */
    citaAt: {
      type: Date,
      default: null,
      index: true,
    },

    fechaEntrada: {
      type: Date,
      default: null,
      index: true,
    },

    fechaSalida: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* Índices */
VisitaSchema.index({ tipo: 1, estado: 1, citaAt: 1 });
VisitaSchema.index({ estado: 1, fechaEntrada: -1 });
VisitaSchema.index({ createdAt: -1 });
VisitaSchema.index({ estado: 1, llegoEnVehiculo: 1 });
VisitaSchema.index({ qrToken: 1 });
VisitaSchema.index({ documento: 1, tipo: 1, createdAt: -1 });

/* Hook: normalización previa */
VisitaSchema.pre("validate", function (next) {
  if (this.estado) {
    this.estado = normalizeEstado(this.estado);
  }

  if (this.tipo && !TIPOS_VISITA.includes(this.tipo)) {
    return next(new Error("Tipo de visita no válido"));
  }

  if (this.estado && !ESTADOS_VISITA.includes(this.estado)) {
    return next(new Error("Estado de visita no válido"));
  }

  next();
});

/* Hook: autollenado y normalización */
VisitaSchema.pre("save", function (next) {
  // Para ingresos directos, si es nuevo y no trae fechaEntrada, se llena automáticamente
  if (this.isNew && this.tipo === "Ingreso" && !this.fechaEntrada) {
    this.fechaEntrada = new Date();
  }

  // Si la cita entra en estado Dentro y no tiene fechaEntrada, se completa
  if (this.estado === "Dentro" && !this.fechaEntrada) {
    this.fechaEntrada = new Date();
  }

  // Normalización defensiva del vehículo
  if (!this.llegoEnVehiculo) {
    this.vehiculo = null;
  } else if (this.vehiculo) {
    this.vehiculo.placa = (this.vehiculo.placa || "").toUpperCase().trim();
    this.vehiculo.marca = (this.vehiculo.marca || "").trim();
    this.vehiculo.modelo = (this.vehiculo.modelo || "").trim();

    const hasVehiculoReal =
      this.vehiculo.placa || this.vehiculo.marca || this.vehiculo.modelo;

    if (!hasVehiculoReal) {
      this.vehiculo = null;
      this.llegoEnVehiculo = false;
    }
  } else {
    this.llegoEnVehiculo = false;
  }

  // Limpieza mínima de QR
  if (this.qrToken !== null) {
    this.qrToken = String(this.qrToken || "").trim() || null;
  }

  if (this.qrPayload !== null) {
    this.qrPayload = String(this.qrPayload || "").trim() || null;
  }

  next();
});

/* Modelo */
const Visita =
  mongoose.models.Visita || mongoose.model("Visita", VisitaSchema);

export default Visita;