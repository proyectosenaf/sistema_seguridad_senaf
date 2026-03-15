// server/modules/iam/models/IamAudit.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const IamAuditSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => typeof v === "string" && v.trim().length > 0,
        message: "action es requerido",
      },
    },

    entity: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => typeof v === "string" && v.trim().length > 0,
        message: "entity es requerido",
      },
    },

    entityId: {
      type: String,
      index: true,
      default: null,
      trim: true,
    },

    actorId: {
      type: String,
      index: true,
      sparse: true,
      default: null,
      trim: true,
    },

    actorEmail: {
      type: String,
      index: true,
      default: "",
      trim: true,
      lowercase: true,
    },

    before: {
      type: Schema.Types.Mixed,
      default: null,
    },

    after: {
      type: Schema.Types.Mixed,
      default: null,
    },

    meta: {
      ip: { type: String, default: null, trim: true },
      ua: { type: String, default: null, trim: true },
      path: { type: String, default: null, trim: true },
      method: { type: String, default: null, trim: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
  }
);

// índices
IamAuditSchema.index({ createdAt: -1 });
IamAuditSchema.index({ entity: 1, action: 1, createdAt: -1 });
IamAuditSchema.index({ actorEmail: 1, createdAt: -1 });
IamAuditSchema.index({ actorId: 1, createdAt: -1 });
IamAuditSchema.index({ entity: 1, createdAt: -1 });
IamAuditSchema.index({ action: 1, createdAt: -1 });

// ✅ fuerza a "iam_audit" sí o sí
const IamAudit =
  mongoose.models.IamAudit ||
  mongoose.model("IamAudit", IamAuditSchema, "iam_audit");

export default IamAudit;