// server/modules/iam/models/IamAudit.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const IamAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: ["create", "update", "delete", "activate", "deactivate"],
      index: true,
      required: true,
    },
    entity: {
      type: String,
      enum: ["user", "role", "permission"],
      index: true,
      required: true,
    },
    entityId: { type: String, index: true, default: null },
    actorId: { type: String, index: true, sparse: true, default: null },
    actorEmail: { type: String, index: true, default: "" },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    meta: {
      ip: { type: String, default: null },
      ua: { type: String, default: null },
      path: { type: String, default: null },
      method: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
  }
);

// índices...
IamAuditSchema.index({ createdAt: -1 });
IamAuditSchema.index({ entity: 1, action: 1, createdAt: -1 });
IamAuditSchema.index({ actorEmail: 1, createdAt: -1 });
IamAuditSchema.index({ entity: 1, createdAt: -1 });
IamAuditSchema.index({ action: 1, createdAt: -1 });

// ✅ fuerza a "iam_audit" sí o sí
const IamAudit =
  mongoose.models.IamAudit || mongoose.model("IamAudit", IamAuditSchema, "iam_audit");

export default IamAudit;