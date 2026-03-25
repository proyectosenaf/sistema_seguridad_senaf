import jwt from "jsonwebtoken";
import IamSession from "../models/IamSession.model.js";

function jwtSecret() {
  const s = String(process.env.JWT_SECRET || "").trim();
  return s || "dev_secret";
}

export async function requireActiveSession(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "no_token" });
    }

    const decoded = jwt.verify(token, jwtSecret());

    const sessionId = decoded?.sid;
    const userIdRaw = decoded?.sub || "";
    const userId = String(userIdRaw).replace("local|", "");

    if (!sessionId || !userId) {
      return res.status(401).json({ ok: false, error: "invalid_session" });
    }

    const session = await IamSession.findOne({
      userId,
      sessionId,
      isActive: true,
    });

    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "session_invalidated",
        message:
          "Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.",
      });
    }

    // Actualizar actividad
    session.lastActivityAt = new Date();
    await session.save().catch(() => {});

    req.session = session;
    req.sessionId = sessionId;

    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}