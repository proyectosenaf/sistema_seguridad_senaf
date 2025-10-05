import mongoose from "mongoose";

const IamPermissionSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, trim: true, unique: true, index: true },
    label: { type: String, required: true, trim: true },
    group: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "iam_permissions" }
);

export default mongoose.model("IamPermission", IamPermissionSchema);
