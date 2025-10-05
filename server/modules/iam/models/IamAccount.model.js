import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema } = mongoose;

const IamAccountSchema = new Schema(
  {
    // Identidad externa (si ya se logueó con tu IdP)
    userId: { type: String, index: true }, // ej: auth0|xxx o tu "sub"

    // Perfil básico
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      sparse: true, // permite múltiples null
    },
    name: { type: String, trim: true },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      sparse: true, // único parcial más abajo
    },
    phone: { type: String, trim: true },

    // Autenticación local (opcional)
    passwordHash: { type: String },
    passwordUpdatedAt: { type: Date },

    // Control de estado
    status: {
      type: String,
      enum: ["invited", "active", "disabled"],
      default: "invited",
      index: true,
    },

    // RBAC
    roleIds: [{ type: Schema.Types.ObjectId, ref: "IamRole", index: true }],

    // Auditoría
    createdBy: { type: String }, // id del admin que lo creó (o "system")
  },
  {
    timestamps: true,
    collection: "iam_accounts",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/* --------- Virtual "active" (boolean) mapeado a status --------- */
IamAccountSchema.virtual("active")
  .get(function () {
    return this.status !== "disabled";
  })
  .set(function (v) {
    this.status = v ? "active" : "disabled";
  });

/* --------- Métodos de contraseña (opcional) --------- */
IamAccountSchema.methods.setPassword = async function (plain) {
  if (!plain) {
    this.passwordHash = undefined;
    this.passwordUpdatedAt = undefined;
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
  this.passwordUpdatedAt = new Date();
};

IamAccountSchema.methods.checkPassword = async function (plain) {
  if (!this.passwordHash || !plain) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

/* --------- Índices útiles --------- */
// Búsqueda por texto en email, username y name
IamAccountSchema.index({ email: "text", username: "text", name: "text" });
// Unicidad parcial (solo cuando hay valor)
IamAccountSchema.index({ email: 1 }, { unique: true, sparse: true });
IamAccountSchema.index({ username: 1 }, { unique: true, sparse: true });

export default mongoose.model("IamAccount", IamAccountSchema);
