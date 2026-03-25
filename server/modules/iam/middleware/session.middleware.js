import jwt from "jsonwebtoken";
import IamSession from "../models/IamSession.model.js";

function jwtSecret() {
  const s = String(process.env.JWT_SECRET || "").trim();
  return s || "dev_secret";
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeRoleName(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function getSuperadminEmails() {
  return Array.from(
    new Set(
      [
        process.env.SUPERADMIN_EMAIL,
        process.env.VITE_SUPERADMIN_EMAIL,
        process.env.ROOT_ADMINS,
        "proyectosenaf@gmail.com",
      ]
        .flatMap((v) =>
          String(v || "")
            .split(",")
            .map((x) => x.trim().toLowerCase())
        )
        .filter(Boolean)
    )
  );
}

function isSuperadminEmail(email) {
  const e = normalizeEmail(email);
  return !!e && getSuperadminEmails().includes(e);
}

function isAdminLike(decoded = {}) {
  const email = normalizeEmail(decoded?.email);
  if (isSuperadminEmail(email)) return true;

  const roles = Array.isArray(decoded?.roles) ? decoded.roles : [];
  const roleSet = new Set(roles.map(normalizeRoleName).filter(Boolean));

  return (
    roleSet.has("admin") ||
    roleSet.has("administrador") ||
    roleSet.has("administrador_it") ||
    roleSet.has("ti") ||
    roleSet.has("superadmin") ||
    roleSet.has("root")
  );
}

export async function requireActiveSession(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "no_token",
        message: "No autenticado.",
      });
    }

    const decoded = jwt.verify(token, jwtSecret());

    const sessionId = String(decoded?.sid || "").trim();
    const userIdRaw = decoded?.sub || "";
    const userId = String(userIdRaw).replace("local|", "").trim();

    if (!sessionId || !userId) {
      return res.status(401).json({
        ok: false,
        error: "invalid_session",
        message: "Sesión inválida.",
      });
    }

    req.auth = { payload: decoded };
    req.sessionId = sessionId;

    // Admin / superadmin: se permite múltiples sesiones.
    if (isAdminLike(decoded)) {
      const session = await IamSession.findOne({
        userId,
        sessionId,
        isActive: true,
      });

      if (session) {
        session.lastActivityAt = new Date();
        await session.save().catch(() => {});
        req.session = session;
      }

      return next();
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
        forceLogout: true,
        message:
          "Solo se permite una sesión activa por cuenta. Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.",
      });
    }

    session.lastActivityAt = new Date();
    await session.save().catch(() => {});

    req.session = session;

    return next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: "invalid_token",
      message: "Token inválido o expirado.",
    });
  }
}