// server/modules/iam/models/IamAudit.model.js
import mongoose from "mongoose";

const IamAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // "perm.create" | "perm.update" | "perm.delete" | "perm.reorder" | "role.create" | "role.update" | "role.delete" | "perm.group.rename" | "perm.group.delete"
    entity: { type: String, required: true }, // "permission" | "role" | "group"
    entityId: { type: String },               // _id o nombre del grupo
    actorId: { type: String },
    actorEmail: { type: String },
    before: { type: Object },                 // snapshot parcial
    after: { type: Object },                  // snapshot parcial
  },
  { timestamps: true, collection: "iam_audit" }
);

IamAuditSchema.index({ createdAt: -1 });

export default mongoose.model("IamAudit", IamAuditSchema);
