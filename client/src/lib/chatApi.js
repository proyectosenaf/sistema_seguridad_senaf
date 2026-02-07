// client/src/lib/chatApi.js
import api from "/src/lib/api.js";

/**
 * Historial de chat
 * GET /chat/messages
 * Params opcionales:
 *  - room: string (default "global")
 *  - limit: number (p.ej. 50)
 */
export async function getChatMessages(params = {}) {
  const { room = "global", limit } = params;
  const { data } = await api.get("/chat/messages", {
    params: { room, limit },
  });
  return data;
}

/**
 * Enviar mensaje
 * POST /chat/messages
 */
export async function sendChatMessage({
  text,
  room = "global",
  userName,
  userEmail,
  userSub,
  extra,
}) {
  const payload = { text, room };
  if (userName) payload.userName = userName;
  if (userEmail) payload.userEmail = userEmail;
  if (userSub) payload.userSub = userSub;
  if (extra && typeof extra === "object") payload.extra = extra;

  const { data } = await api.post("/chat/messages", payload);
  return data;
}

export const getMessages = getChatMessages;
export const postMessage = sendChatMessage;

export default { getChatMessages, sendChatMessage, getMessages, postMessage };
