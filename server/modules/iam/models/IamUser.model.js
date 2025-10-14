import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    externalId: { type: String, index: true }, // sub/JWT si aplica (Auth0: auth0|xxx)
    auth0Id:    { type: String, index: true }, // opcional: id en Auth0 (auth0|xxx) si usas Management API
    email: {
      type: String,
      required: true,
      unique: true,        // índice único
      lowercase: true,     // normaliza
      trim: true,
    },
    name:   { type: String, trim: true },
    active: { type: Boolean, default: true },

    // RBAC
    roles:  { type: [String], default: [] }, // nombres/códigos de rol
    perms:  { type: [String], default: [] }, // permisos directos (opcional)

    // Autenticación local / proveedores
    provider:    { type: String, enum: ["local", "auth0"], default: "local", index: true },
    passwordHash:{ type: String, select: false }, // solo si usas login local
  },
  {
    timestamps: true,
    collection: "iamusers",
  }
);

// índices
IamUserSchema.index({ email: 1 }, { unique: true });
IamUserSchema.index({ provider: 1 });
IamUserSchema.index({ auth0Id: 1 });

export default mongoose.model("IamUser", IamUserSchema);
