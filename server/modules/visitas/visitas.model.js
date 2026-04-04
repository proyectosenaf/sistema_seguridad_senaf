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

/* Subdocumento para acompañantes */
const AcompananteVisitanteSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    documento: {
      type: String,
      required: true,
      trim: true,
    },
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

function cleanText(value) {
  return String(value || "").trim();
}

function cleanDoc(value) {
  return String(value || "").replace(/\D/g, "");
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
        validator: (v) =>
          v == null || v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
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

    /* Acompañantes */
    acompanado: {
      type: Boolean,
      default: false,
      index: true,
    },

    acompanantes: {
      type: [AcompananteVisitanteSchema],
      default: [],
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

    /* QR de cita
       Regla de negocio:
       - Solo debe existir cuando la cita esté Autorizada
       - Si la cita vuelve a otro estado, el QR se invalida */
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

    qrGeneratedAt: {
      type: Date,
      default: null,
    },

    autorizadaAt: {
      type: Date,
      default: null,
      index: true,
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

    /* Feedback / satisfacción */
    feedbackEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },

    feedbackRequestedAt: {
      type: Date,
      default: null,
      index: true,
    },

    feedbackSubmitted: {
      type: Boolean,
      default: false,
      index: true,
    },

    feedbackScore: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },

    feedbackSubmittedAt: {
      type: Date,
      default: null,
      index: true,
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
VisitaSchema.index({ acompanado: 1, createdAt: -1 });
VisitaSchema.index({ autorizadaAt: -1 });
VisitaSchema.index({ feedbackEnabled: 1, feedbackSubmitted: 1, estado: 1 });
VisitaSchema.index({ correo: 1, feedbackEnabled: 1, feedbackSubmitted: 1 });
VisitaSchema.index({ documento: 1, feedbackEnabled: 1, feedbackSubmitted: 1 });

/* Hook: normalización previa */
VisitaSchema.pre("validate", function (next) {
  if (this.estado) {
    this.estado = normalizeEstado(this.estado);
  }

  this.nombre = cleanText(this.nombre);
  this.documento = cleanText(this.documento);
  this.empresa = this.empresa == null ? null : cleanText(this.empresa) || null;
  this.empleado =
    this.empleado == null ? null : cleanText(this.empleado) || null;
  this.motivo = cleanText(this.motivo);
  this.telefono =
    this.telefono == null ? null : cleanText(this.telefono) || null;
  this.correo =
    this.correo == null ? null : cleanText(this.correo).toLowerCase() || null;

  if (this.tipo && !TIPOS_VISITA.includes(this.tipo)) {
    return next(new Error("Tipo de visita no válido"));
  }

  if (this.estado && !ESTADOS_VISITA.includes(this.estado)) {
    return next(new Error("Estado de visita no válido"));
  }

  if (this.tipo === "Agendada" && !this.citaAt) {
    return next(
      new Error("Las visitas agendadas deben tener fecha y hora en citaAt")
    );
  }

  if (
    this.feedbackScore != null &&
    (!Number.isInteger(this.feedbackScore) ||
      this.feedbackScore < 1 ||
      this.feedbackScore > 5)
  ) {
    return next(new Error("feedbackScore debe estar entre 1 y 5"));
  }

  next();
});

/* Hook: autollenado y normalización */
VisitaSchema.pre("save", function (next) {
  if (this.isNew && this.tipo === "Ingreso" && !this.fechaEntrada) {
    this.fechaEntrada = new Date();
  }

  if (this.estado === "Dentro" && !this.fechaEntrada) {
    this.fechaEntrada = new Date();
  }

  if (this.estado === "Finalizada" && !this.fechaSalida) {
    this.fechaSalida = new Date();
  }

  if (!Array.isArray(this.acompanantes)) {
    this.acompanantes = [];
  }

  this.acompanantes = this.acompanantes
    .map((item) => ({
      nombre: cleanText(item?.nombre),
      documento: cleanText(item?.documento),
    }))
    .filter((item) => item.nombre && item.documento);

  if (this.acompanantes.length > 0) {
    this.acompanado = true;
  }

  if (this.acompanado && this.acompanantes.length === 0) {
    return next(
      new Error(
        "Debe registrar al menos un acompañante cuando acompanado es true"
      )
    );
  }

  if (this.acompanado && Array.isArray(this.acompanantes)) {
    const documentoPrincipal = cleanDoc(this.documento);

    const sameDoc = this.acompanantes.some(
      (item) => cleanDoc(item.documento) === documentoPrincipal
    );

    if (sameDoc) {
      return next(
        new Error(
          "Un acompañante no puede tener el mismo documento del visitante principal"
        )
      );
    }
  }

  if (this.acompanantes.length > 1) {
    const seen = new Set();

    for (const item of this.acompanantes) {
      const doc = cleanDoc(item.documento);
      if (seen.has(doc)) {
        return next(
          new Error("No se permiten acompañantes con el mismo documento")
        );
      }
      seen.add(doc);
    }
  }

  if (!this.acompanado) {
    this.acompanantes = [];
  }

  if (!this.llegoEnVehiculo) {
    this.vehiculo = null;
  } else if (this.vehiculo) {
    this.vehiculo.placa = cleanText(this.vehiculo.placa).toUpperCase();
    this.vehiculo.marca = cleanText(this.vehiculo.marca);
    this.vehiculo.modelo = cleanText(this.vehiculo.modelo);

    const hasVehiculoReal =
      this.vehiculo.placa || this.vehiculo.marca || this.vehiculo.modelo;

    if (!hasVehiculoReal) {
      this.vehiculo = null;
      this.llegoEnVehiculo = false;
    }
  } else {
    this.llegoEnVehiculo = false;
    this.vehiculo = null;
  }

  if (this.qrToken !== null) {
    this.qrToken = String(this.qrToken || "").trim() || null;
  }

  if (this.qrPayload !== null) {
    this.qrPayload = String(this.qrPayload || "").trim() || null;
  }

  /* Regla central:
     si no está autorizada, no debe conservar QR */
  if (this.estado !== "Autorizada") {
    this.qrToken = null;
    this.qrPayload = null;
    this.qrGeneratedAt = null;
    this.validatedAt = null;
    this.validatedBy = null;
  }

  if (this.estado === "Autorizada" && !this.autorizadaAt) {
    this.autorizadaAt = new Date();
  }

  /* Feedback: se habilita cuando la visita finaliza */
  if (this.estado === "Finalizada") {
    if (!this.feedbackRequestedAt) {
      this.feedbackRequestedAt = new Date();
    }
    this.feedbackEnabled = true;
  }

  next();
});

const Visita =
  mongoose.models.Visita || mongoose.model("Visita", VisitaSchema);

export default Visita;