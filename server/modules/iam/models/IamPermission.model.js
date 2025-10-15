
import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true },
  group: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ group: 1, order: 1 });
schema.index({ key: 1 }, { unique: true });

export default mongoose.model("IamPermission", schema, "iampermissions");
