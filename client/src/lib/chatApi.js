import api from "/src/lib/api.js";

/**
 * Historial de chat
 * GET /chat/messages
 * Params:
 *  - room: string
 *  - limit: number
 */
export async function getChatMessages(params = {}) {
  const { room = "global", limit = 50 } = params;

  const { data } = await api.get("/chat/messages", {
    params: { room, limit },
  });

  return Array.isArray(data) ? data : [];
}

function buildBasePayload({
  room = "global",
  clientId,
  userName,
  userEmail,
  userSub,
  userId,
  extra,
}) {
  const payload = { room };

  if (clientId) payload.clientId = clientId;
  if (userName) payload.userName = userName;
  if (userEmail) payload.userEmail = userEmail;
  if (userSub) payload.userSub = userSub;
  if (userId) payload.userId = userId;
  if (extra && typeof extra === "object") payload.extra = extra;

  return payload;
}

/**
 * Enviar mensaje de texto
 * POST /chat/messages
 */
export async function sendChatMessage({
  text,
  room = "global",
  clientId,
  userName,
  userEmail,
  userSub,
  userId,
  extra,
}) {
  const payload = buildBasePayload({
    room,
    clientId,
    userName,
    userEmail,
    userSub,
    userId,
    extra,
  });

  payload.text = String(text || "").trim();
  payload.type = "text";

  const { data } = await api.post("/chat/messages", payload);
  return data;
}

/**
 * Enviar mensaje de audio
 * POST /chat/messages
 */
export async function sendAudioMessage({
  audioUrl,
  room = "global",
  clientId,
  userName,
  userEmail,
  userSub,
  userId,
  extra,
}) {
  const payload = buildBasePayload({
    room,
    clientId,
    userName,
    userEmail,
    userSub,
    userId,
    extra,
  });

  payload.type = "audio";
  payload.audioUrl = String(audioUrl || "").trim();
  payload.text = "";

  const { data } = await api.post("/chat/messages", payload);
  return data;
}

/**
 * Enviar archivo o imagen
 * POST /chat/messages
 */
export async function sendFileMessage({
  fileUrl,
  fileName,
  fileType = "file",
  text = "",
  room = "global",
  clientId,
  userName,
  userEmail,
  userSub,
  userId,
  extra,
}) {
  const normalizedType = String(fileType || "file").trim().toLowerCase();
  const type = normalizedType === "image" ? "image" : "file";

  const payload = buildBasePayload({
    room,
    clientId,
    userName,
    userEmail,
    userSub,
    userId,
    extra,
  });

  payload.type = type;
  payload.fileUrl = String(fileUrl || "").trim();
  payload.fileName = String(fileName || "").trim() || null;
  payload.text = String(text || "").trim();

  const { data } = await api.post("/chat/messages", payload);
  return data;
}

/**
 * Editar mensaje
 * PUT /chat/messages/:id
 */
export async function editChatMessage(messageId, { text, userId, userSub, userEmail }) {
  const id = String(messageId || "").trim();
  const payload = {
    text: String(text || "").trim(),
  };

  if (userId) payload.userId = userId;
  if (userSub) payload.userSub = userSub;
  if (userEmail) payload.userEmail = userEmail;

  const { data } = await api.put(`/chat/messages/${id}`, payload);
  return data;
}

/**
 * Eliminar mensaje
 * DELETE /chat/messages/:id
 */
export async function deleteChatMessage(messageId, { userId, userSub, userEmail } = {}) {
  const id = String(messageId || "").trim();

  const { data } = await api.delete(`/chat/messages/${id}`, {
    data: {
      userId: userId || null,
      userSub: userSub || null,
      userEmail: userEmail || null,
    },
  });

  return data;
}

/**
 * Marcar mensaje como visto
 * POST /chat/messages/:id/seen
 */
export async function markMessageSeen(messageId, { userId, userSub } = {}) {
  const id = String(messageId || "").trim();

  const { data } = await api.post(`/chat/messages/${id}/seen`, {
    userId: userId || null,
    userSub: userSub || null,
  });

  return data;
}

/**
 * Subir archivo genérico de chat
 * Ajusta la ruta si luego creas una específica para chat.
 */
export async function uploadChatFile(file) {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post("/chat/upload", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data;
}

/**
 * Subir audio grabado
 * Ajusta la ruta si luego creas una específica para chat.
 */
export async function uploadChatAudio(blob, filename = "audio.webm") {
  const form = new FormData();
  form.append("file", blob, filename);

  const { data } = await api.post("/chat/upload", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data;
}

/**
 * Enviar mensaje privado por socket
 */
export function sendPrivateMessage(socket, payload) {
  return new Promise((resolve) => {
    if (!socket) return resolve({ ok: false });

    socket.emit("chat:private:send", payload, (ack) => {
      resolve(ack || { ok: false });
    });
  });
}

/**
 * Unirse a chat privado
 */
export function joinPrivateChat(socket, { fromUserId, toUserId }) {
  if (!socket) return;
  socket.emit("chat:private:join", { fromUserId, toUserId });
}

/**
 * Salir de chat privado
 */
export function leavePrivateChat(socket, { fromUserId, toUserId, room }) {
  if (!socket) return;
  socket.emit("chat:private:leave", { fromUserId, toUserId, room });
}

/**
 * Typing por socket
 */
export function emitTyping(socket, { room, userId, name }) {
  if (!socket) return;
  socket.emit("chat:typing", { room, userId, name });
}

export function emitStopTyping(socket, { room, userId }) {
  if (!socket) return;
  socket.emit("chat:stopTyping", { room, userId });
}

/**
 * Seen por socket
 */
export function emitSeen(socket, { room, messageId, userId }) {
  if (!socket) return;
  socket.emit("chat:seen", { room, messageId, userId });
}

export const getMessages = getChatMessages;
export const postMessage = sendChatMessage;

export default {
  getChatMessages,
  sendChatMessage,
  sendAudioMessage,
  sendFileMessage,
  editChatMessage,
  deleteChatMessage,
  markMessageSeen,
  uploadChatFile,
  uploadChatAudio,
  sendPrivateMessage,
  joinPrivateChat,
  leavePrivateChat,
  emitTyping,
  emitStopTyping,
  emitSeen,
  getMessages,
  postMessage,
};