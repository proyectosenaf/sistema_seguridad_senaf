import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    // ✅ Auth0 "sub" (auth0|xxxxx) — ID primario recomendado
    externalId: { type: String, trim: true, index: true },

    // (Opcional) si quieres guardar otro id, pero normalmente no hace falta
    auth0Id: { type: String, trim: true, index: true },

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
    },

    passwordHash: { type: String, select: false },
  },
  { timestamps: true, collection: "iamusers" }
);

// Email único
IamUserSchema.index({ email: 1 }, { unique: true });

// ✅ externalId único (pero permitir null/undefined sin romper)
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });

IamUserSchema.index({ provider: 1 });
IamUserSchema.index({ auth0Id: 1 });

export default mongoose.model("IamUser", IamUserSchema);
