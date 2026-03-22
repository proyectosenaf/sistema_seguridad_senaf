import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    room: { type: String, index: true },

    clientId: { type: String, index: true },

    user: {
      id: { type: String },
      sub: { type: String },
      name: { type: String },
      email: { type: String },
    },

    text: { type: String, default: "" },

    // nuevos tipos
    type: {
      type: String,
      enum: ["text", "audio", "file", "image", "system"],
      default: "text",
    },

    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    audioUrl: { type: String, default: null },

    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },

    seenBy: [
      {
        userId: String,
        seenAt: Date,
      },
    ],
  },
  { timestamps: true }
);

ChatMessageSchema.index({ room: 1, createdAt: 1 });

export default mongoose.model("ChatMessage", ChatMessageSchema);