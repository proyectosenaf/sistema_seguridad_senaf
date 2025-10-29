// server/modules/iam/models/IamUser.model.js
import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    externalId:  { type: String, trim: true },                 // p.ej. sub de JWT (auth0|xxx)
    auth0Id:     { type: String, trim: true },                 // opcional: id en Auth0
    email:       { type: String, required: true, lowercase: true, trim: true },
    name:        { type: String, trim: true },
    active:      { type: Boolean, default: true },

    // RBAC
    roles:       { type: [String], default: [] },
    perms:       { type: [String], default: [] },

    // Autenticación
    provider:    { type: String, enum: ["local", "auth0"], default: "local" },
    passwordHash:{ type: String, select: false },
  },
  {
    timestamps: true,
    collection: "iamusers",
  }
);

/* ───────────── Índices (definirlos SOLO aquí) ───────────── */
// Email único (no uso sparse porque email es required)
IamUserSchema.index({ email: 1 }, { unique: true });

// Si consultas por provider, mantenlo
IamUserSchema.index({ provider: 1 });

// Si usas auth0Id para lookup frecuente, indexa (deja unique si lo necesitas)
IamUserSchema.index({ auth0Id: 1 }); // ó { auth0Id: 1 }, { unique: true, sparse: true }

// Si buscas por externalId (sub), indexarlo ayuda
IamUserSchema.index({ externalId: 1 });

export default mongoose.model("IamUser", IamUserSchema);
