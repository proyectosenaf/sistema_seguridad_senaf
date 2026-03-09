// server/modules/iam/models/IamPermission.model.js
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    group: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "iam_permissions",  
  }
);

// Índice para orden por grupo
schema.index({ group: 1, order: 1 });

// Normaliza strings
schema.pre("save", function (next) {
  if (this.isModified("key") && typeof this.key === "string") {
    this.key = this.key.trim().toLowerCase();
  }
  if (this.isModified("group") && typeof this.group === "string") {
    this.group = this.group.trim().toLowerCase();
  }
  if (this.isModified("label") && typeof this.label === "string") {
    this.label = this.label.trim();
  }
  if (this.isModified("order")) {
    const n = Number(this.order);
    this.order = Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  next();
});

schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};
  const setObj = u.$set && typeof u.$set === "object" ? u.$set : u;

  if (setObj.key && typeof setObj.key === "string") {
    setObj.key = setObj.key.trim().toLowerCase();
  }
  if (setObj.group && typeof setObj.group === "string") {
    setObj.group = setObj.group.trim().toLowerCase();
  }
  if (setObj.label && typeof setObj.label === "string") {
    setObj.label = setObj.label.trim();
  }
  if (setObj.order != null) {
    const n = Number(setObj.order);
    setObj.order = Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  if (u.$set) u.$set = setObj;

  this.setUpdate(u);
  next();
});

export default mongoose.models.IamPermission ||
  mongoose.model("IamPermission", schema);