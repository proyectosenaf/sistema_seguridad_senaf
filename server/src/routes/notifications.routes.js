// src/routes/notifications.routes.js
import { Router } from "express";
import { celebrate, Joi, Segments } from "celebrate";
import { requireAuth } from "../security/authz.js";
import Notification from "../models/Notification.js";

const router = Router();

// Todas requieren auth
router.use(requireAuth);

/** GET /api/notifications/counts */
router.get(
  "/counts",
  celebrate({
    [Segments.QUERY]: Joi.object({
      // opcional: en el futuro podrías filtrar por siteId
    }),
  }),
  async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.email || req.user?.id;
      const counts = await Notification.countsForUser({ userId });
      return res.json(counts);
    } catch (err) {
      console.error("[notifications] counts error:", err);
      return res.status(500).json({ error: "Error obteniendo contadores" });
    }
  }
);

/** GET /api/notifications
 * Listado con filtros básicos del usuario
 */
router.get(
  "/",
  celebrate({
    [Segments.QUERY]: Joi.object({
      page: Joi.number().min(1).default(1),
      limit: Joi.number().min(1).max(100).default(20),
      read: Joi.boolean().optional(),
      severity: Joi.string().valid("info", "low", "medium", "high", "critical").optional(),
      kind: Joi.string().optional(),
      archived: Joi.boolean().optional(),
    }),
  }),
  async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.email || req.user?.id;
      const { page, limit, read, severity, kind, archived } = req.query;

      const q = { userId };
      if (typeof read === "boolean") q.read = read;
      if (typeof archived === "boolean") q.archived = archived;
      if (severity) q.severity = severity;
      if (kind) q.kind = kind;

      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        Notification.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(q),
      ]);

      return res.json({ items, total, page, limit });
    } catch (err) {
      console.error("[notifications] list error:", err);
      return res.status(500).json({ error: "Error listando notificaciones" });
    }
  }
);

/** POST /api/notifications/:id/read — marca una notificación como leída */
router.post(
  "/:id/read",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
  }),
  async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.email || req.user?.id;
      const n = await Notification.findById(req.params.id);
      if (!n) return res.status(404).json({ error: "Notificación no encontrada" });
      if (n.userId && n.userId !== userId) {
        return res.status(403).json({ error: "No autorizado" });
      }
      await n.markRead({ userId });
      return res.json(n.toJSON());
    } catch (err) {
      console.error("[notifications] read error:", err);
      return res.status(500).json({ error: "Error marcando notificación" });
    }
  }
);

/** POST /api/notifications/read-all — marca todas como leídas del usuario */
router.post(
  "/read-all",
  async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.email || req.user?.id;
      const now = new Date();
      const upd = await Notification.updateMany(
        { userId, read: false, archived: false },
        { $set: { read: true, readAt: now }, $push: { readBy: { userId, at: now } } }
      );
      return res.json({ ok: true, modified: upd.modifiedCount });
    } catch (err) {
      console.error("[notifications] read-all error:", err);
      return res.status(500).json({ error: "Error marcando todas" });
    }
  }
);

/** POST /api/notifications/:id/archive — archiva una notificación */
router.post(
  "/:id/archive",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
  }),
  async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.email || req.user?.id;
      const n = await Notification.findById(req.params.id);
      if (!n) return res.status(404).json({ error: "Notificación no encontrada" });
      if (n.userId && n.userId !== userId) {
        return res.status(403).json({ error: "No autorizado" });
      }
      n.archived = true;
      await n.save();
      return res.json(n.toJSON());
    } catch (err) {
      console.error("[notifications] archive error:", err);
      return res.status(500).json({ error: "Error archivando notificación" });
    }
  }
);

export default router;
