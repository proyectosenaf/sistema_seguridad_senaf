import ChatMessage from '../models/ChatMessage.js';

export const listMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.find({ room: 'global' })
      .sort({ createdAt: 1 }) // orden cronológico
      .limit(100); // puedes ajustar el límite si quieres paginación

    res.json(messages);
  } catch (err) {
    console.error('[chat] Error al listar mensajes:', err);
    res.status(500).json({ message: 'Error al obtener mensajes del chat' });
  }
};
