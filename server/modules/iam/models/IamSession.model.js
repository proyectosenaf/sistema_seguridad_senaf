import mongoose from "mongoose";

const IamSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
      required: true,
    },
    email: {
      type: String,
      index: true,
      default: "",
    },

    sessionId: {
      type: String,
      index: true,
      required: true,
    },
    jwtId: {
      type: String,
      index: true,
      default: "",
    },

    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    device: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "closed", "expired", "kicked", "replaced"],
      default: "active",
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    disconnectedAt: {
      type: Date,
      default: null,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
    kickedAt: {
      type: Date,
      default: null,
    },

    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

IamSessionSchema.index({ userId: 1, isActive: 1 });
IamSessionSchema.index({ sessionId: 1, isActive: 1 });
IamSessionSchema.index({ email: 1, isActive: 1 });
IamSessionSchema.index({ lastActivityAt: -1, connectedAt: -1 });

export default mongoose.model("IamSession", IamSessionSchema);