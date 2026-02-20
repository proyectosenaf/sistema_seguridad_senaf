// Middleware para forzar cambio de contraseña
// Creado el 19/02/2026 para implementar cambio de contraseña y vencimiento
import jwt from "jsonwebtoken";
import IamUser from "../../modules/iam/models/IamUser.model.js";

export default async function forcePasswordChange(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(); // si no hay token, dejamos que otros middlewares manejen
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.auth = { payload: decoded };

    const user = await IamUser.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({ ok: false, error: "Usuario inválido" });
    }

    // Si debe cambiar contraseña y no está en la ruta de cambio
    if (
      user.mustChangePassword &&
      !req.path.includes("/auth/change-password")
    ) {
      return res.status(403).json({
        ok: false,
        error: "Debe cambiar su contraseña antes de continuar"
      });
    }

    next();

  } catch (err) {
    next();
  }
}
// Middleware para forzar cambio de contraseña
// Creado el 19/02/2026 para implementar cambio de contraseña y vencimiento