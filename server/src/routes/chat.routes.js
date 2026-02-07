// server/src/routes/chat.routes.js
import express from "express";
import ChatMessage from "../models/ChatMessage.js";

const router = express.Router();

function cleanRoom(v) {
  const raw = String(v || "global").trim();
  // solo letras, números, guiones, underscore y dos puntos
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, "");
  return safe || "global";
}

/** helper: identidad desde req.user (DEV) o req.auth.payload (JWT) o fallback */
function resolveUser(req, body = {}) {
  const u = req.user || {};
  const p = req.auth?.payload || {};

  const sub = u.sub || p.sub || body.userSub || null;
  const email = u.email || p.email || body.userEmail || null;

  // nombre: req.user → token → body → email → "Usuario"
  const name =
    u.name ||
    p.name ||
    body.userName ||
    body.userEmail ||
    email ||
    "Usuario";

  return { sub, name, email };
}

/**
 * GET /chat/messages?room=global&limit=50
 * Respuesta: array de mensajes
 */
router.get("/messages", async (req, res, next) => {
  try {
    const room = cleanRoom(req.query.room);
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const items = await ChatMessage.find({ room })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return res.json(items);
  } catch (e) {
    return next(e);
  }
});

/**
 * POST /chat/messages
 * body: { text, room, clientId, userName, userEmail, userSub }
 */
router.post("/messages", async (req, res, next) => {
  try {
    const room = cleanRoom(req.body.room);
    const text = String(req.body.text || "").trim();
    const clientId = req.body.clientId ? String(req.body.clientId).trim() : null;

    if (!text) {
      return res.status(400).json({ ok: false, error: "text requerido" });
    }

    const user = resolveUser(req, req.body);

    // ✅ Upsert por (room, clientId) para evitar duplicados por reintento
    // Si no hay clientId, crea normal.
    let doc;

    if (clientId) {
      doc = await ChatMessage.findOneAndUpdate(
        { room, clientId },
        { $setOnInsert: { room, clientId, text, user } },
        { new: true, upsert: true }
      );
    } else {
      doc = await ChatMessage.create({ room, text, user, clientId: null });
    }

    const msg = doc.toObject();

    // ✅ broadcast a room
    req.io?.to(`chat:${room}`)?.emit("chat:new", msg);

    return res.json(msg);
  } catch (e) {
    // Si se coló un duplicate key por race condition, devolvemos el existente
    if (e?.code === 11000) {
      try {
        const room = cleanRoom(req.body.room);
        const clientId = req.body.clientId ? String(req.body.clientId).trim() : null;
        if (clientId) {
          const existing = await ChatMessage.findOne({ room, clientId }).lean();
          if (existing) return res.json(existing);
        }
      } catch {}
    }
    return next(e);
  }
});

export default router;
      