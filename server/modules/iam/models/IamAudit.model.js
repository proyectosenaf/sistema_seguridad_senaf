// server/modules/iam/models/IamAudit.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const IamAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "activate",
        "deactivate",
        "enable",   // compat (opcional)
        "disable",  // compat (opcional)
      ],
      index: true,
      required: true,
    },
    entity: {
      type: String,
      enum: ["user", "role", "permission"],
      index: true,
      required: true,
    },
    entityId: { type: String, index: true },

    actorId: { type: String, index: true, sparse: true },
    actorEmail: { type: String, index: true, default: "" },

    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,

    // ✅ para guardar ip/ua/path/method
    meta: {
      ip: { type: String, default: null },
      ua: { type: String, default: null },
      path: { type: String, default: null },
      method: { type: String, default: null },
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
    minimize: false,
  }
);

/* Índices */
IamAuditSchema.index({ createdAt: -1 });
IamAuditSchema.index({ entity: 1, action: 1, createdAt: -1 });
IamAuditSchema.index({ actorEmail: 1, createdAt: -1 });
IamAuditSchema.index({ entity: 1, createdAt: -1 });
IamAuditSchema.index({ action: 1, createdAt: -1 });

// TTL opcional
// IamAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("IamAudit", IamAuditSchema);