// src/routes/chat.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import ChatMessage from "../models/ChatMessage.js";

const router = Router();
router.use(requireAuth);

// Historial
router.get("/messages", async (_req, res) => {
  const items = await ChatMessage.find().sort({ createdAt: 1 }).lean();
  res.json(items);
});

// Crear mensaje
router.post("/messages", async (req, res) => {
  // Del token (si existiera)
  const t = req.auth?.payload || {};
  // Fallback desde el body (por si el token no trae name/email)
  const user = {
    sub: t.sub ?? req.body.userSub ?? null,
    name: t.name ?? req.body.userName ?? null,
    email: t.email ?? req.body.userEmail ?? null,
  };

  const msg = await ChatMessage.create({
    room: req.body.room || "global",
    text: req.body.text,
    user,
  });

  res.status(201).json(msg);
});

export default router;