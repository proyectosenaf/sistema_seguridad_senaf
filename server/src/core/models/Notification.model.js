// server/core/models/Notification.model.js
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true, index: true },  // ej: auth0 sub
    type:     { type: String, required: true },               // 'assignment' | 'incident' | 'panic' | 'generic'
    title:    { type: String, required: true },
    body:     { type: String, default: "" },
    meta:     { type: Object, default: {} },
    readAt:   { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: "notifications" }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

NotificationSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

export default Notification;
