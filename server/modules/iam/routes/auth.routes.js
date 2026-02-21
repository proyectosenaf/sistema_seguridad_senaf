// server/src/routes/iam.me.routes.js (ejemplo)
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

//Importando el modelo de usuario, password para validar passwords, y jwt para generar tokens si es necesario
//Creado el 18/02/2026 para implementar cambio de contraseña y vencimiento
import IamUser from "../models/IamUser.model.js";
import { verifyPassword, hashPassword} from "../utils/password.util.js";
import jwt from "jsonwebtoken";
//Importando el modelo de usuario, password para validar passwords, y jwt para generar tokens si es necesario
//Creado el 18/02/2026 para implementar cambio de contraseña y vencimiento

const r = Router();

r.get("/me", async (req, res, next) => {
  try {
    const ctx = await buildContextFrom(req);
    res.json({ user: ctx.user, roles: ctx.roles, permissions: ctx.permissions });
  } catch (e) {
    next(e);
  }
});

//Endpoint de login local (email + password) creado el 18/02/2026 para implementar cambio de contraseña y vencimiento
r.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    const user = await IamUser.findOne({ email: email.toLowerCase() }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({ error: "Credenciales no válidas" });
    }

    if (user.provider !== "local") {
      return res.status(400).json({ error: "Usuario autenticado externamente (Auth0)" });
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Credenciales no válidas" });
    }

    if (!user.active) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    // Validando expiración de contraseña
    let mustChange = user.mustChangePassword;

    if (user.passwordExpiresAt && new Date() > user.passwordExpiresAt) {
      mustChange = true;
    }

    // Generar llave(JWT)
    const token = jwt.sign(
      {
        sub: user._id,
        email: user.email,
        roles: user.roles,
        permissions: user.perms,
        provider: "local"
      },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "8h" }
    );

    res.json({
      token,
      mustChangePassword: mustChange
    });

  } catch (err) {
    next(err);
  }
});
//Endpoint de login local (email + password) creado el 18/02/2026 para implementar cambio de contraseña y vencimiento

//Endpoint para cambio de contraseña, creado el 18/02/2026 para implementar cambio de contraseña y vencimiento
r.post("/change-password", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ ok: false, error: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    const userId = decoded.sub;

    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    const user = await IamUser.findById(userId).select("+passwordHash");

    if (!user) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }

    const match = await verifyPassword(passwordActual, user.passwordHash);

    if (!match) {
      return res.status(400).json({ ok: false, error: "Contraseña actual incorrecta" });
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

    return res.json({ ok: true, message: "Contraseña actualizada correctamente" });

  } catch (err) {
    next(err);
  }
});
//Endpoint para cambio de contraseña, creado el 18/02/2026 para implementar cambio de contraseña y vencimiento

export default r;
