import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    // ✅ Auth0 "sub" (auth0|xxxxx) — ID primario recomendado
    externalId: { type: String, trim: true }, // <- sin index:true

    // (Opcional) si quieres guardar otro id, pero normalmente no hace falta
    auth0Id: { type: String, trim: true }, // <- sin index:true

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    name: { type: String, trim: true },

    active: { type: Boolean, default: true },

    // RBAC
    roles: { type: [String], default: [] },
    perms: { type: [String], default: [] },

    provider: {
      type: String,
      enum: ["local", "auth0"],
      default: "auth0",
      index: true, // este sí está ok (no lo duplicamos con schema.index)
    },

    passwordHash: { type: String, select: false },
  },
  { timestamps: true, collection: "iamusers" }
);

// Email único
IamUserSchema.index({ email: 1 }, { unique: true });

// externalId único (permite null/undefined)
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });

// auth0Id index (opcional; si no existe, no rompe)
IamUserSchema.index({ auth0Id: 1 }, { sparse: true });

export default mongoose.model("IamUser", IamUserSchema);
