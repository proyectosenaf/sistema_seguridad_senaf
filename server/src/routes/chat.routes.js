import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import ChatMessage from "../models/ChatMessage.js";

const router = express.Router();

const CHAT_UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "chat");
if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
  fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
}

function cleanRoom(v) {
  const raw = String(v || "global").trim();
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, "");
  return safe || "global";
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanClientId(v) {
  const s = String(v || "").trim();
  return s || null;
}

function cleanOptionalString(v) {
  const s = String(v || "").trim();
  return s || null;
}

function cleanType(v) {
  const allowed = new Set(["text", "audio", "file", "image", "system"]);
  const type = String(v || "text").trim().toLowerCase();
  return allowed.has(type) ? type : "text";
}

function resolveUser(req, body = {}) {
  const u = req.user || {};
  const p = req.auth?.payload || {};

  const sub =
    u.sub || u.id || u._id || p.sub || body.userSub || body.userId || null;

  const id =
    u.id || u._id || u.sub || body.userId || body.userSub || p.sub || null;

  const email = u.email || p.email || body.userEmail || null;

  const name =
    u.name ||
    u.nombre ||
    p.name ||
    body.userName ||
    body.userEmail ||
    email ||
    "Usuario";

  return {
    id: id ? String(id).trim() : null,
    sub: sub ? String(sub).trim() : null,
    name: String(name || "Usuario").trim(),
    email: email ? String(email).trim().toLowerCase() : null,
  };
}

function getSafeBody(req) {
  if (req && req.body && typeof req.body === "object") return req.body;
  return {};
}

function getActorUserId(req, body = {}) {
  const u = req.user || {};
  const p = req.auth?.payload || {};
  const b = body && typeof body === "object" ? body : {};

  return String(
    u.id ||
      u._id ||
      u.sub ||
      p.sub ||
      b.userId ||
      b.userSub ||
      b.actorUserId ||
      b.email ||
      ""
  ).trim();
}

function getActorEmail(req, body = {}) {
  const b = body && typeof body === "object" ? body : {};
  return String(req.user?.email || req.auth?.payload?.email || b.userEmail || "")
    .trim()
    .toLowerCase();
}

function canManageMessage(msg, actorUserId, actorEmail) {
  if (!msg) return false;

  const ownerIds = [msg?.user?.id, msg?.user?._id, msg?.user?.sub]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const ownerEmail = String(msg?.user?.email || "")
    .trim()
    .toLowerCase();

  if (actorUserId && ownerIds.includes(actorUserId)) return true;
  if (actorEmail && ownerEmail && ownerEmail === actorEmail) return true;

  return false;
}

function sanitizeFilename(name) {
  const base = String(name || "archivo")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .trim();

  return base || "archivo";
}

function detectKindFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  return "file";
}

function buildStoredFileUrl(filename) {
  return `/uploads/chat/${filename}`;
}

function emitChatNew(req, room, msg) {
  if (!req.io || !room || !msg) return;
  req.io.to(`chat:${room}`).emit("chat:new", msg);
}

function emitChatUpdate(req, room, msg) {
  if (!req.io || !room || !msg) return;
  req.io.to(`chat:${room}`).emit("chat:update", msg);
}

function emitChatDelete(req, room, msg) {
  if (!req.io || !room || !msg) return;
  req.io.to(`chat:${room}`).emit("chat:delete", msg);
}

function emitChatSeen(req, room, payload) {
  if (!req.io || !room || !payload) return;
  req.io.to(`chat:${room}`).emit("chat:seen", payload);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CHAT_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || "";
    const base = path.basename(file.originalname || "archivo", ext);
    const safeBase = sanitizeFilename(base);
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${stamp}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

/**
 * POST /chat/upload
 * form-data:
 * - file
 * - room
 * - clientId
 * - userId | userSub | userName | userEmail
 * - type (opcional)
 *
 * Devuelve un MENSAJE COMPLETO de chat, no solo metadata.
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    const body = getSafeBody(req);

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "file requerido" });
    }

    const room = cleanRoom(body.room);
    const clientId = cleanClientId(body.clientId);
    const explicitType = cleanType(body.type);
    const detectedKind = detectKindFromMime(req.file.mimetype);

    let type = explicitType;
    if (!body.type || explicitType === "text") {
      type = detectedKind;
    }

    const fileUrl = buildStoredFileUrl(req.file.filename);
    const fileName = cleanOptionalString(req.file.originalname) || req.file.filename;
    const user = resolveUser(req, body);

    const payload = {
      room,
      clientId,
      text: type === "file" ? fileName : "",
      user,
      type,
      fileUrl: type === "file" || type === "image" ? fileUrl : null,
      fileName: type === "file" || type === "image" ? fileName : null,
      audioUrl: type === "audio" ? fileUrl : null,
    };

    let doc;

    if (clientId) {
      doc = await ChatMessage.findOneAndUpdate(
        { room, clientId },
        { $setOnInsert: payload },
        { new: true, upsert: true }
      );
    } else {
      doc = await ChatMessage.create({
        ...payload,
        clientId: null,
      });
    }

    const msg = doc.toObject ? doc.toObject() : doc;

    emitChatNew(req, room, msg);

    return res.json(msg);
  } catch (e) {
    if (e?.code === 11000) {
      try {
        const body = getSafeBody(req);
        const room = cleanRoom(body.room);
        const clientId = cleanClientId(body.clientId);

        if (clientId) {
          const existing = await ChatMessage.findOne({ room, clientId }).lean();
          if (existing) return res.json(existing);
        }
      } catch {}
    }

    return next(e);
  }
});

/**
 * GET /chat/messages?room=global&limit=50
 */
router.get("/messages", async (req, res, next) => {
  try {
    const room = cleanRoom(req.query.room);
    const rawLimit = Number(req.query.limit || 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 200)
      : 50;

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
 */
router.post("/messages", async (req, res, next) => {
  try {
    const body = getSafeBody(req);

    const room = cleanRoom(body.room);
    const text = cleanText(body.text);
    const clientId = cleanClientId(body.clientId);
    const type = cleanType(body.type);
    const fileUrl = cleanOptionalString(body.fileUrl);
    const fileName = cleanOptionalString(body.fileName);
    const audioUrl = cleanOptionalString(body.audioUrl);

    const requiresText = type === "text" || type === "system";
    if (requiresText && !text) {
      return res.status(400).json({ ok: false, error: "text requerido" });
    }

    if (type === "audio" && !audioUrl) {
      return res.status(400).json({ ok: false, error: "audioUrl requerido" });
    }

    if ((type === "file" || type === "image") && !fileUrl) {
      return res.status(400).json({ ok: false, error: "fileUrl requerido" });
    }

    const user = resolveUser(req, body);

    const payload = {
      room,
      clientId,
      text,
      user,
      type,
      fileUrl,
      fileName,
      audioUrl,
    };

    let doc;

    if (clientId) {
      doc = await ChatMessage.findOneAndUpdate(
        { room, clientId },
        { $setOnInsert: payload },
        { new: true, upsert: true }
      );
    } else {
      doc = await ChatMessage.create({
        ...payload,
        clientId: null,
      });
    }

    const msg = doc.toObject ? doc.toObject() : doc;

    emitChatNew(req, room, msg);

    return res.json(msg);
  } catch (e) {
    if (e?.code === 11000) {
      try {
        const body = getSafeBody(req);
        const room = cleanRoom(body.room);
        const clientId = cleanClientId(body.clientId);

        if (clientId) {
          const existing = await ChatMessage.findOne({ room, clientId }).lean();
          if (existing) return res.json(existing);
        }
      } catch {}
    }

    return next(e);
  }
});

/**
 * PUT /chat/messages/:id
 */
router.put("/messages/:id", async (req, res, next) => {
  try {
    const body = getSafeBody(req);

    const id = String(req.params.id || "").trim();
    const text = cleanText(body.text);

    if (!text) {
      return res.status(400).json({ ok: false, error: "text requerido" });
    }

    const msg = await ChatMessage.findById(id);
    if (!msg) {
      return res.status(404).json({ ok: false, error: "Mensaje no encontrado" });
    }

    if (msg.deleted) {
      return res
        .status(400)
        .json({ ok: false, error: "No se puede editar un mensaje eliminado" });
    }

    const actorUserId = getActorUserId(req, body);
    const actorEmail = getActorEmail(req, body);

    if (!canManageMessage(msg, actorUserId, actorEmail)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    msg.text = text;
    msg.edited = true;
    await msg.save();

    const out = msg.toObject ? msg.toObject() : msg;

    emitChatUpdate(req, msg.room, out);

    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

/**
 * DELETE /chat/messages/:id
 */
router.delete("/messages/:id", async (req, res, next) => {
  try {
    const body = getSafeBody(req);
    const id = String(req.params.id || "").trim();

    const msg = await ChatMessage.findById(id);
    if (!msg) {
      return res.status(404).json({ ok: false, error: "Mensaje no encontrado" });
    }

    const actorUserId = getActorUserId(req, body);
    const actorEmail = getActorEmail(req, body);

    if (!canManageMessage(msg, actorUserId, actorEmail)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    msg.deleted = true;
    msg.text = "";
    msg.fileUrl = null;
    msg.fileName = null;
    msg.audioUrl = null;
    msg.edited = false;

    await msg.save();

    const out = msg.toObject ? msg.toObject() : msg;

    emitChatDelete(req, msg.room, out);

    return res.json({ ok: true, message: out });
  } catch (e) {
    return next(e);
  }
});

/**
 * POST /chat/messages/:id/seen
 */
router.post("/messages/:id/seen", async (req, res, next) => {
  try {
    const body = getSafeBody(req);
    const id = String(req.params.id || "").trim();
    const actorUserId = getActorUserId(req, body);

    if (!actorUserId) {
      return res.status(400).json({ ok: false, error: "userId requerido" });
    }

    const msg = await ChatMessage.findById(id);
    if (!msg) {
      return res.status(404).json({ ok: false, error: "Mensaje no encontrado" });
    }

    if (!Array.isArray(msg.seenBy)) {
      msg.seenBy = [];
    }

    const alreadySeen = msg.seenBy.some(
      (x) => String(x?.userId || "").trim() === String(actorUserId).trim()
    );

    if (!alreadySeen) {
      msg.seenBy.push({
        userId: actorUserId,
        seenAt: new Date(),
      });
      await msg.save();
    }

    const out = msg.toObject ? msg.toObject() : msg;

    emitChatSeen(req, msg.room, {
      _id: out._id,
      room: out.room,
      seenBy: out.seenBy || [],
      userId: actorUserId,
    });

    return res.json({ ok: true, seenBy: out.seenBy || [] });
  } catch (e) {
    return next(e);
  }
});

export default router;