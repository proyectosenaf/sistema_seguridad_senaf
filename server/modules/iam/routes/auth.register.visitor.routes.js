import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { hashPassword } from "../utils/password.util.js";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeName(v) {
  return String(v || "").trim();
}

function hasNonEmptyPassword(p) {
  return String(p || "").trim().length >= 8;
}

function hasRole(user, role) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.map((x) => String(x).toLowerCase()).includes(String(role).toLowerCase());
}

/**
 * POST /register-visitor
 * body: { name, email, password }
 *
 * Reglas:
 * - Si ya existe usuario:
 *   - si es visita => 409 user_exists
 *   - si NO es visita => 403 email_reserved
 * - Si no existe:
 *   - crea usuario local con roles:["visita"]
 *   - mustChangePassword:false
 *   - otpVerifiedAt: null (para que pida OTP en primer login)
 */
r.post("/register-visitor", async (req, res, next) => {
  try {
    const name = safeName(req.body?.name);
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "name_required" });
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }
    if (!hasNonEmptyPassword(password)) {
      return res.status(400).json({ ok: false, error: "password_too_short", minLength: 8 });
    }

    const existing = await IamUser.findOne({ email }).lean();

    if (existing) {
      const isVisitor = Array.isArray(existing.roles)
        ? existing.roles.map((x) => String(x).toLowerCase()).includes("visita")
        : false;

      if (!isVisitor) {
        return res.status(403).json({
          ok: false,
          error: "email_reserved",
          message: "Este correo pertenece a un usuario interno. Contacta al administrador.",
        });
      }

      return res.status(409).json({
        ok: false,
        error: "user_exists",
        message: "Ya existe una cuenta con ese correo. Inicia sesión.",
      });
    }

    const passwordHash = await hashPassword(password);

    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 2);

    const user = await IamUser.create({
      email,
      name,
      provider: "local",
      active: true,
      roles: ["visita"],
      perms: [],
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: now,
      passwordExpiresAt: expires,

      // 🔴 CORREGIDO: ahora sí pedirá OTP en primer login
      otpVerifiedAt: null,

      tempPassHash: "",
      tempPassExpiresAt: null,
      tempPassUsedAt: null,
      tempPassAttempts: 0,
    });

    return res.status(201).json({
      ok: true,
      created: { id: String(user._id), email: user.email, name: user.name },
      message: "Registro completado. Ya puedes iniciar sesión.",
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, error: "user_exists" });
    }
    next(e);
  }
});

export default r;