// src/models/Notification.js
import mongoose, { Schema, model } from "mongoose";

/**
 * Pensado para:
 * - notificaciones por usuario y/o por sitio
 * - severidad y tipo (kind)
 * - payload (meta) flexible
 * - enlaces (link) hacia el frontend
 * - caducidad opcional (expiresAt)
 * - marcado de lectura por usuario (readAt/readBy)
 * - archivado
 */

const readBySchema = new Schema(
  {
    userId: { type: String, required: true }, // sub/email/ID app
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const notificationSchema = new Schema(
  {
    // Scope/tenancy
    tenantId: { type: String, index: true }, // opcional si tienes multiempresa
    siteId: { type: Schema.Types.ObjectId, ref: "Site", index: true }, // opcional

    // Target
    userId: { type: String, index: true }, // usuario destinatario (Auth0 sub o email)
    audience: {
      type: String,
      enum: ["user", "site", "global"],
      default: "user",
      index: true,
    },

    // Clasificación
    kind: { type: String, required: true, index: true }, // ej: "rondas.missed", "incident.created"
    severity: { type: String, enum: ["info", "low", "medium", "high", "critical"], default: "info", index: true },

    // Contenido
    title: { type: String },
    message: { type: String, required: true },

    // Enlace opcional hacia UI
    link: {
      href: { type: String }, // ej: /rondas/monitor?shift=...
      label: { type: String },
    },

    // Datos extra para la UI (IDs relacionados, etc)
    meta: { type: Schema.Types.Mixed },

    // Estado
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    readBy: [readBySchema], // si varios usuarios pueden “consumir” la misma
    archived: { type: Boolean, default: false, index: true },

    // Caducidad opcional (limpieza por TTL)
    expiresAt: { type: Date, index: true },

    // Dedupe opcional: evita duplicados exactos por ventana
    dedupeKey: { type: String, index: true },
  },
  { timestamps: true }
);

// Índices compuestos comunes para listados rápidos
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ siteId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ kind: 1, createdAt: -1 });

// Normaliza output
notificationSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => ret,
});

/** Marcar como leída por un usuario específico */
notificationSchema.methods.markRead = async function ({ userId }) {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
  }
  if (userId) {
    const already = (this.readBy || []).some((r) => r.userId === userId);
    if (!already) this.readBy = [...(this.readBy || []), { userId, at: new Date() }];
  }
  await this.save();
  return this;
};

/** Estático: contadores por usuario */
notificationSchema.statics.countsForUser = async function ({ userId }) {
  const [unread, total, alerts] = await Promise.all([
    this.countDocuments({ userId, read: false, archived: false }),
    this.countDocuments({ userId, archived: false }),
    this.countDocuments({ userId, severity: { $in: ["high", "critical"] }, archived: false }),
  ]);
  return { unread, total, alerts };
};

/** Estático: crear con dedupe opcional (por dedupeKey en ventana X minutos) */
notificationSchema.statics.createIfNotExists = async function (doc, { dedupeWindowMinutes = 0 } = {}) {
  if (doc.dedupeKey && dedupeWindowMinutes > 0) {
    const since = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000);
    const exists = await this.findOne({
      dedupeKey: doc.dedupeKey,
      createdAt: { $gte: since },
    }).lean();
    if (exists) return exists;
  }
  return this.create(doc);
};

const Notification = model("Notification", notificationSchema);
export default Notification;
