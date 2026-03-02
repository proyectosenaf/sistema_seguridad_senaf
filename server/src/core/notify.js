  // server/core/notify.js
  import Notification from "./models/Notification.model.js";

  /**
   * makeNotifier({ io, mailer })
   * - io: instancia de socket.io (opcional pero recomendado)
   * - mailer: nodemailer u otro (opcional)
   */
  export function makeNotifier({ io, mailer } = {}) {
    function roomForUser(userId) {
      // rooms del estilo guard-<sub> para guardias, o user-<id> genérico
      // Puedes unificar la convención aquí:
      return [`user-${userId}`, `guard-${userId}`];
    }

    async function _persistAndEmit({
      userId,
      type,
      title,
      body = "",
      meta = {},
      email,
    }) {
      // 1) Persistencia
      const doc = await Notification.create({
        userId,
        type,
        title,
        body,
        meta,
      });

      // 2) Contador no leído
      const unread = await Notification.countDocuments({
        userId,
        readAt: null,
      });

      // 3) Tiempo real (contador)
      if (io && userId) {
        for (const room of roomForUser(userId)) {
          io.to(room).emit("notifications:count-updated", { count: unread });
        }
      }

      // 4) Correo (opcional)
      if (mailer && email) {
        try {
          await mailer.sendMail({
            from: '"Sistema" <noreply@your.domain>',
            to: email,
            subject: title,
            html: `<h3>${title}</h3><p>${body || ""}</p>`,
          });
        } catch (e) {
          console.warn("[notify.mailer] error:", e?.message || e);
        }
      }

      return { doc, unread };
    }

    /* ─────────── API de alto nivel (para otros módulos) ─────────── */

    // Nueva asignación (Rondas)
    async function assignment({
      userId,
      email,
      siteName,
      roundName,
      startTime,
      endTime,
      assignmentId,
    }) {
      const title = "Nueva ronda asignada";
      const body = `${roundName || ""} — ${siteName || ""} (${
        startTime || "--:--"
      } a ${endTime || "--:--"})`;
      const meta = { assignmentId, siteName, roundName, startTime, endTime };

      const { doc, unread } = await _persistAndEmit({
        userId,
        type: "assignment",
        title,
        body,
        meta,
        email,
      });

      // Fanout específico del módulo (si tienes una UI escuchando esto)
      if (io && userId) {
        for (const room of roomForUser(userId)) {
          io.to(room).emit("rondasqr:nueva-asignacion", {
            title,
            body,
            meta,
            id: doc.id,
          });
        }
      }
      return { id: doc.id, unread };
    }

    // Incidente creado/actualizado
    async function incident({ userId, email, siteName, message, incidentId }) {
      const title = "Nuevo incidente reportado";
      const body = `${siteName || ""}: ${message?.slice(0, 140) || ""}`;
      const meta = { incidentId, siteName };

      const { doc } = await _persistAndEmit({
        userId,
        type: "incident",
        title,
        body,
        meta,
        email,
      });

      if (io && userId) {
        for (const room of roomForUser(userId)) {
          io.to(room).emit("incidents:new", {
            title,
            body,
            meta,
            id: doc.id,
          });
        }
      }
      return { id: doc.id };
    }

    // Botón de pánico
    async function panic({ userId, email, siteName, gps }) {
      const title = "🚨 Alerta de pánico";
      const body = siteName
        ? `Sitio: ${siteName}`
        : "Se activó el botón de pánico";
      const meta = { gps, siteName };

      const { doc } = await _persistAndEmit({
        userId,
        type: "panic",
        title,
        body,
        meta,
        email,
      });

      if (io) {
        io.emit("panic:new", { title, body, meta, id: doc.id }); // broadcast global si quieres
      }
      return { id: doc.id };
    }

    // Notificación genérica
    async function generic({ userId, email, title, body = "", meta = {} }) {
      const { doc } = await _persistAndEmit({
        userId,
        type: "generic",
        title,
        body,
        meta,
        email,
      });

      if (io && userId) {
        for (const room of roomForUser(userId)) {
          io.to(room).emit("notify:generic", {
            title,
            body,
            meta,
            id: doc.id,
          });
        }
      }
      return { id: doc.id };
    }

    /* ─────────── Utilidades de conteo/lectura ─────────── */

    async function getUnreadCount(userId) {
      if (!userId) return 0;
      return Notification.countDocuments({ userId, readAt: null });
    }

    async function markAllRead(userId) {
      if (!userId) return { updated: 0 };
      const r = await Notification.updateMany(
        { userId, readAt: null },
        { $set: { readAt: new Date() } }
      );
      // refresca contador a 0 en tiempo real
      if (io) {
        for (const room of roomForUser(userId)) {
          io.to(room).emit("notifications:count-updated", { count: 0 });
        }
      }
      return { updated: r.modifiedCount || 0 };
    }

    return {
      assignment,
      incident,
      panic,
      generic,
      getUnreadCount,
      markAllRead,
    };
  }
