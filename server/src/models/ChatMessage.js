// server/src/models/ChatMessage.js
import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    room: { type: String, default: "global", index: true },

    // ✅ NUEVO: clientId para dedupe (optimistic -> server)
    clientId: { type: String, index: true },

    user: {
      sub: { type: String, default: null },
      name: { type: String, default: "Usuario" },
      email: { type: String, default: null },
    },

    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// (opcional) índice compuesto útil
ChatMessageSchema.index({ room: 1, createdAt: 1 });

export default mongoose.model("ChatMessage", ChatMessageSchema);
