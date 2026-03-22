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

function getActorUserId(req, body = {}) {
  const u = req.user || {};
  const p = req.auth?.payload || {};

  return String(
    u.id ||
      u._id ||
      u.sub ||
      p.sub ||
      body.userId ||
      body.userSub ||
      body.actorUserId ||
      body.email ||
      ""
  ).trim();
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
 * form-data: file
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "file requerido" });
    }

    const kind = detectKindFromMime(req.file.mimetype);
    const url = `/uploads/chat/${req.file.filename}`;

    return res.json({
      ok: true,
      url,
      name: req.file.originalname,
      fileName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      kind,
    });
  } catch (e) {
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
    const room = cleanRoom(req.body.room);
    const text = cleanText(req.body.text);
    const clientId = cleanClientId(req.body.clientId);
    const type = cleanType(req.body.type);
    const fileUrl = cleanOptionalString(req.body.fileUrl);
    const fileName = cleanOptionalString(req.body.fileName);
    const audioUrl = cleanOptionalString(req.body.audioUrl);

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

    const user = resolveUser(req, req.body);

    let doc;

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

    if (req.io) {
      req.io.to(`chat:${room}`).emit("chat:new", msg);
    }

    return res.json(msg);
  } catch (e) {
    if (e?.code === 11000) {
      try {
        const room = cleanRoom(req.body.room);
        const clientId = cleanClientId(req.body.clientId);

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
    const id = String(req.params.id || "").trim();
    const text = cleanText(req.body.text);

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

    const actorUserId = getActorUserId(req, req.body);
    const actorEmail = String(
      req.user?.email || req.auth?.payload?.email || req.body.userEmail || ""
    )
      .trim()
      .toLowerCase();

    if (!canManageMessage(msg, actorUserId, actorEmail)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    msg.text = text;
    msg.edited = true;
    await msg.save();

    const out = msg.toObject ? msg.toObject() : msg;

    if (req.io) {
      req.io.to(`chat:${msg.room}`).emit("chat:update", out);
    }

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
    const id = String(req.params.id || "").trim();

    const msg = await ChatMessage.findById(id);
    if (!msg) {
      return res.status(404).json({ ok: false, error: "Mensaje no encontrado" });
    }

    const actorUserId = getActorUserId(req, req.body);
    const actorEmail = String(
      req.user?.email || req.auth?.payload?.email || req.body.userEmail || ""
    )
      .trim()
      .toLowerCase();

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

    if (req.io) {
      req.io.to(`chat:${msg.room}`).emit("chat:delete", out);
    }

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
    const id = String(req.params.id || "").trim();
    const actorUserId = getActorUserId(req, req.body);

    if (!actorUserId) {
      return res.status(400).json({ ok: false, error: "userId requerido" });
    }

    const msg = await ChatMessage.findById(id);
    if (!msg) {
      return res.status(404).json({ ok: false, error: "Mensaje no encontrado" });
    }

    const alreadySeen = Array.isArray(msg.seenBy)
      ? msg.seenBy.some(
          (x) => String(x?.userId || "").trim() === String(actorUserId).trim()
        )
      : false;

    if (!alreadySeen) {
      msg.seenBy.push({
        userId: actorUserId,
        seenAt: new Date(),
      });
      await msg.save();
    }

    const out = msg.toObject ? msg.toObject() : msg;

    if (req.io) {
      req.io.to(`chat:${msg.room}`).emit("chat:seen", {
        _id: out._id,
        room: out.room,
        seenBy: out.seenBy || [],
        userId: actorUserId,
      });
    }

    return res.json({ ok: true, seenBy: out.seenBy || [] });
  } catch (e) {
    return next(e);
  }
});

export default router;