import Notification from '../models/Notification.js';

export const countNotifications = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ leido: false }); // ejemplo: solo no leídas
    res.json({ count });
  } catch (err) {
    console.error('[notifications] Error al contar:', err);
    res.status(500).json({ message: 'Error interno al contar notificaciones' });
  }
};
