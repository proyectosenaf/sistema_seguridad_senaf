import { Router } from "express";
import jwt from "jsonwebtoken";
import IamUser from "../models/IamUser.model.js";
import { hashPassword, verifyPassword } from "../utils/password.util.js";
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/**
 * POST /api/iam/v1/auth/temp/verify
 * (Este router se monta en /auth con authMw)
 * Body: { tempPassword }
 * Retorna: { preauth }
 */
r.post("/temp/verify", async (req, res, next) => {
  try {
    const { tempPassword } = req.body || {};
    const pwd = String(tempPassword || "").trim();
    if (!pwd) return res.status(400).json({ ok: false, error: "tempPassword requerido" });

    // authMw debe dejar req.auth.payload
    const p = req?.auth?.payload || {};
    const email = normEmail(p.email);
    const auth0Sub = String(p.sub || "").trim();

    if (!email && !auth0Sub) {
      return res.status(401).json({ ok: false, error: "missing_identity" });
    }

    // Traer usuario (incluye tempPassHash)
    const u = await IamUser.findOne({
      $or: [
        ...(auth0Sub ? [{ auth0Sub }] : []),
        ...(email ? [{ email }] : []),
      ],
    })
      .select("+tempPassHash")
      .lean();

    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    if (!u.mustChangePassword) {
      return res.json({ ok: true, mustChangePassword: false });
    }

    if (u.tempPassUsedAt) {
      return res.status(401).json({ ok: false, error: "temp_used", message: "Clave temporal ya usada" });
    }

    const exp = u.tempPassExpiresAt ? new Date(u.tempPassExpiresAt).getTime() : 0;
    if (!exp || exp <= Date.now()) {
      return res.status(401).json({ ok: false, error: "temp_expired", message: "Clave temporal vencida" });
    }

    if ((u.tempPassAttempts || 0) >= 5) {
      return res.status(429).json({
        ok: false,
        error: "too_many_attempts",
        message: "Demasiados intentos. Solicita nueva clave temporal.",
      });
    }

    const ok = await verifyPassword(pwd, String(u.tempPassHash || ""));
    if (!ok) {
      await IamUser.updateOne({ _id: u._id }, { $inc: { tempPassAttempts: 1 } });
      return res.status(401).json({ ok: false, error: "temp_invalid", message: "Clave temporal incorrecta" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_JWT_SECRET" });
    }

    const preauth = jwt.sign(
      { uid: String(u._id), purpose: "pw_change" },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    await writeAudit(req, {
      action: "temp_password_verify",
      entity: "user",
      entityId: String(u._id),
      before: null,
      after: { ok: true },
    });

    return res.json({ ok: true, preauth });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/iam/v1/auth/password/change
 * Header: Authorization: Bearer <preauth>
 * Body: { newPassword }
 */
r.post("/password/change", async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    const pwd = String(newPassword || "").trim();

    if (!pwd) return res.status(400).json({ ok: false, error: "newPassword requerido" });
    if (pwd.length < 10) {
      return res.status(400).json({ ok: false, error: "min_10_chars", message: "Mínimo 10 caracteres" });
    }

    const raw = String(req.headers.authorization || "");
    const token = raw.replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ ok: false, error: "missing_token" });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_JWT_SECRET" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "token_invalid_or_expired" });
    }

    if (payload?.purpose !== "pw_change" || !payload?.uid) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const before = await IamUser.findById(payload.uid).select("+passwordHash").lean();
    if (!before) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    const passwordHash = await hashPassword(pwd);

    await IamUser.updateOne(
      { _id: payload.uid },
      {
        $set: {
          passwordHash,
          provider: "local",
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          tempPassUsedAt: new Date(),
          tempPassExpiresAt: null,
          tempPassAttempts: 0,
          tempPassHash: "",
        },
      }
    );

    await writeAudit(req, {
      action: "password_change_from_temp",
      entity: "user",
      entityId: String(payload.uid),
      before: { mustChangePassword: true },
      after: { mustChangePassword: false },
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default r;