import mongoose from "mongoose";

const IamUserSchema = new mongoose.Schema(
  {
    // ✅ Auth0 "sub" (auth0|xxxxx)
    auth0Sub: { type: String, trim: true },
    externalId: { type: String, trim: true },
    auth0Id: { type: String, trim: true },

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
      index: true,
    },

    passwordHash: { type: String, select: false },

    // Cambio para cambio de contraseña y vencimiento, hecho el 18/02/2026
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    passwordExpiresAt: { type: Date },
    // Cambio para cambio de contraseña y vencimiento, hecho el 18/02/2026
  },
  { timestamps: true, collection: "iamusers" }
);

// Email único
IamUserSchema.index({ email: 1 }, { unique: true });

// auth0Sub único (permite null/undefined)
IamUserSchema.index({ auth0Sub: 1 }, { unique: true, sparse: true });

// externalId único (permite null/undefined)
IamUserSchema.index({ externalId: 1 }, { unique: true, sparse: true });

// auth0Id index (opcional)
IamUserSchema.index({ auth0Id: 1 }, { sparse: true });

export default mongoose.model("IamUser", IamUserSchema);