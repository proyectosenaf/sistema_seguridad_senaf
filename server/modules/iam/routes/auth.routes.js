import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

//Importando el modelo de usuario, password para validar passwords, y jwt para generar tokens si es necesario
//Creado el 18/02/2026 para implementar cambio de contraseña y vencimiento
import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js";
import jwt from "jsonwebtoken";
//Importando el modelo de usuario, password para validar passwords, y jwt para generar tokens si es necesario
//Creado el 18/02/2026 para implementar cambio de contraseña y vencimiento

const r = Router();

/* ===================== ME ===================== */
async function handleMe(req, res, next) {
  try {
    const ctx = await buildContextFrom(req);
    res.json({
      user: ctx.user,
      roles: ctx.roles,
      permissions: ctx.permissions,
      // extra útil (no rompe nada si no lo usas)
      email: ctx.email,
      auth0Sub: ctx.auth0Sub,
      visitor: ctx.isVisitor,
      isSuperAdmin: ctx.isSuperAdmin,
    });
  } catch (e) {
    next(e);
  }
}

// ✅ IMPORTANTE: este router se monta en /api/iam/v1/auth
// por eso aquí SOLO usamos /me, /login, etc.
r.get("/me", handleMe);

/* ===================== LOGIN (LOCAL) ===================== */
async function handleLogin(req, res, next) {
  try {
    const emailRaw = req.body?.email;
    const password = req.body?.password;

    const email = String(emailRaw || "").toLowerCase().trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    const user = await IamUser.findOne({ email }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({ error: "Credenciales no válidas" });
    }

    if (user.provider !== "local") {
      return res
        .status(400)
        .json({ error: "Usuario autenticado externamente (Auth0)" });
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Credenciales no válidas" });
    }

    if (!user.active) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    // Validando expiración de contraseña
    let mustChange = !!user.mustChangePassword;

    if (user.passwordExpiresAt && new Date() > user.passwordExpiresAt) {
      mustChange = true;
    }

    // Generar llave(JWT)
    const token = jwt.sign(
      {
        sub: String(user._id),
        email: user.email,
        roles: user.roles,
        permissions: user.perms,
        provider: "local",
      },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "8h" }
    );

    res.json({
      token,
      mustChangePassword: mustChange,
    });
  } catch (err) {
    next(err);
  }
}

r.post("/login", handleLogin);

/* ===================== CHANGE PASSWORD (LOCAL) ===================== */
async function handleChangePassword(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !String(authHeader).toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ ok: false, error: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    } catch (e) {
      return res
        .status(401)
        .json({ ok: false, error: "Token inválido o expirado" });
    }

    const userId = decoded?.sub ? String(decoded.sub) : null;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    const user = await IamUser.findById(userId).select("+passwordHash");

    if (!user) {
      return res
        .status(404)
        .json({ ok: false, error: "Usuario no encontrado" });
    }

    // ✅ solo users locales pueden cambiar password aquí
    if (user.provider !== "local") {
      return res.status(400).json({
        ok: false,
        error: "Usuario autenticado externamente (Auth0)",
      });
    }

    if (!user.active) {
      return res.status(403).json({ ok: false, error: "Usuario inactivo" });
    }

    const match = await verifyPassword(passwordActual, user.passwordHash);

    if (!match) {
      return res
        .status(400)
        .json({ ok: false, error: "Contraseña actual incorrecta" });
    }

    const newHash = await hashPassword(passwordNueva);

    const now = new Date();
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 2);

    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.passwordExpiresAt = expires;

    await user.save();

    return res.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (err) {
    next(err);
  }
}

r.post("/change-password", handleChangePassword);

/* ===================== BOOTSTRAP ADMIN (1ra vez) ===================== */
/**
 * POST /api/iam/v1/auth/bootstrap
 * - Solo funciona si NO hay usuarios en la colección
 * - Crea el primer admin local usando ROOT_ADMINS o SUPERADMIN_EMAIL
 *
 * Body:
 * { email, password, name? }
 */
r.post("/bootstrap", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const password = String(req.body?.password || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y password requeridos" });
    }

    const count = await IamUser.countDocuments({});
    if (count > 0) {
      return res.status(409).json({ ok: false, error: "Bootstrap ya no disponible" });
    }

    const rootAdmins = String(process.env.ROOT_ADMINS || "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const superEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();

    const allowed = (superEmail && email === superEmail) || rootAdmins.includes(email);

    if (!allowed) {
      return res.status(403).json({ ok: false, error: "Email no permitido para bootstrap" });
    }

    const passwordHash = await hashPassword(password);

    const user = await IamUser.create({
      email,
      name: name || email.split("@")[0],
      provider: "local",
      passwordHash,
      active: true,
      roles: ["admin"],
      perms: ["*"],
      mustChangePassword: false,
    });

    return res.status(201).json({
      ok: true,
      created: { id: String(user._id), email: user.email },
      message: "Admin bootstrap creado. Ya puedes usar /auth/login",
    });
  } catch (e) {
    next(e);
  }
});

export default r;