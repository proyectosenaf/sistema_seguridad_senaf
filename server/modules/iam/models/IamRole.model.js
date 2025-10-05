import mongoose from "mongoose";

const IamRoleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, unique: true, index: true }, // p.ej. "admin"
    name: { type: String, required: true, trim: true },                             // p.ej. "Administrador general"
    description: { type: String, trim: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true, collection: "iam_roles" }
);

export default mongoose.model("IamRole", IamRoleSchema);
