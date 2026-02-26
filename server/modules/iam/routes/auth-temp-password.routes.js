// server/modules/iam/routes/auth-temp-password.routes.js
import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { hashPassword, verifyPassword } from "../utils/password.util.js";
import { writeAudit } from "../utils/audit.util.js";
import { signToken, verifyToken, getBearer } from "../utils/jwt.util.js";

const r = Router();

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/**
 * POST /api/iam/v1/auth/temp/verify
 * Body: { tempPassword }
 *
 * ✅ SIN Auth0:
 * - Identidad viene del authMw local en req.auth.payload (email/sub/uid)
 * - Verifica tempPassHash y devuelve un preauth token corto (5m).
 */
r.post("/temp/verify", async (req, res, next) => {
  try {
    const { tempPassword } = req.body || {};
    const pwd = String(tempPassword || "").trim();
    if (!pwd) return res.status(400).json({ ok: false, error: "tempPassword requerido" });

    // authMw debe dejar req.auth.payload
    const p = req?.auth?.payload || {};
    const email = normEmail(p.email);
    const uid = String(p.uid || p.sub || "").trim(); // compat: sub=userId local

    if (!email && !uid) {
      return res.status(401).json({ ok: false, error: "missing_identity" });
    }

    const query = uid ? { _id: uid } : { email };

    const u = await IamUser.findOne(query).select("+tempPassHash").lean();
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    if (!u.active) {
      return res.status(403).json({ ok: false, error: "user_inactive", message: "Usuario inactivo" });
    }

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

    // preauth token corto (solo para cambio de contraseña)
    const preauth = signToken(
      { uid: String(u._id), purpose: "pw_change" },
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

    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "missing_token" });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ ok: false, error: "token_invalid_or_expired" });
    }

    if (payload?.purpose !== "pw_change" || !payload?.uid) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const user = await IamUser.findById(payload.uid).select("+passwordHash").lean();
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    if (!user.active) {
      return res.status(403).json({ ok: false, error: "user_inactive", message: "Usuario inactivo" });
    }

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