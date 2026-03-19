// server/modules/iam/models/IamPermission.model.js
import mongoose from "mongoose";

function normKey(v) {
  return String(v || "").trim().toLowerCase();
}

function normGroup(v) {
  return String(v || "").trim().toLowerCase();
}

function normLabel(v) {
  return String(v || "").trim();
}

function normOrder(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      set: normKey,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      default: "",
      set: normLabel,
    },

    group: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "",
      set: normGroup,
    },

    order: {
      type: Number,
      default: 0,
      set: normOrder,
    },
  },
  {
    timestamps: true,
    collection: "iam_permissions",
  }
);

// índices
schema.index({ key: 1 }, { unique: true });
schema.index({ group: 1, order: 1 });

// normalización al guardar
schema.pre("save", function (next) {
  this.key = normKey(this.key);
  this.group = normGroup(this.group);
  this.label = normLabel(this.label);
  this.order = normOrder(this.order);
  next();
});

// normalización en updates
schema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};

  if (typeof u?.key === "string") {
    u.key = normKey(u.key);
  }
  if (typeof u?.$set?.key === "string") {
    u.$set.key = normKey(u.$set.key);
  }

  if (u?.label !== undefined) {
    u.label = normLabel(u.label);
  }
  if (u?.$set?.label !== undefined) {
    u.$set.label = normLabel(u.$set.label);
  }

  if (typeof u?.group === "string") {
    u.group = normGroup(u.group);
  }
  if (typeof u?.$set?.group === "string") {
    u.$set.group = normGroup(u.$set.group);
  }

  if (u?.order !== undefined) {
    u.order = normOrder(u.order);
  }
  if (u?.$set?.order !== undefined) {
    u.$set.order = normOrder(u.$set.order);
  }

  this.setUpdate(u);
  next();
});

export default mongoose.models.IamPermission ||
  mongoose.model("IamPermission", schema);