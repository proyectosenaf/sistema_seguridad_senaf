import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    // p.ej. sub de JWT (auth0|xxx)
    externalId: { type: String, trim: true },

    // opcional: id directo en Auth0
    auth0Id: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    name: { type: String, trim: true },

    active: { type: Boolean, default: true },

    // RBAC básico
    roles: { type: [String], default: [] },
    perms: { type: [String], default: [] },

    // Autenticación
    provider: {
      type: String,
      enum: ["local", "auth0"],
      default: "local",
    },

    passwordHash: { type: String, select: false },
  },
  {
    timestamps: true,
    collection: "iamusers",
  }
);

/* ───────────── Índices (solo aquí) ───────────── */

// Email único
IamUserSchema.index({ email: 1 }, { unique: true });

// Si consultas por provider
IamUserSchema.index({ provider: 1 });

// Para búsquedas por auth0Id
IamUserSchema.index({ auth0Id: 1 });

// Para búsquedas por externalId (sub)
IamUserSchema.index({ externalId: 1 });

export default mongoose.model("IamUser", IamUserSchema);
