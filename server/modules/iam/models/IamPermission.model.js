import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key:   { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    group: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "iam_permissions", // 👈 con guion bajo
  }
);

// índices
schema.index({ group: 1, order: 1 });
// ❌ NO definimos index({ key: 1 }) aquí: unique:true ya crea ese índice

export default mongoose.model("IamPermission", schema);
