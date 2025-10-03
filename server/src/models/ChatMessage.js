import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    room: { type: String, default: "global" },
    user: { sub: String, name: String, email: String },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true } // crea createdAt/updatedAt
);

// (Opcional) Auto-limpiar mensajes de más de 30 días
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("ChatMessage", ChatMessageSchema);
// export const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema); 