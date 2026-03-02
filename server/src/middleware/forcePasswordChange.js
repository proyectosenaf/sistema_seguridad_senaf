  // server/src/middleware/forcePasswordChange.js
  // Middleware para forzar cambio de contraseña
  // Creado el 19/02/2026 para implementar cambio de contraseña y vencimiento

  import jwt from "jsonwebtoken";
  import IamUser from "../../modules/iam/models/IamUser.model.js";

  function getTokenFromHeader(req) {
    const h = req.headers.authorization;
    if (!h) return null;
    const parts = String(h).split(" ");
    if (parts.length !== 2) return null;
    if (parts[0].toLowerCase() !== "bearer") return null;
    return parts[1] || null;
  }

  function jwtSecret() {
    return process.env.JWT_SECRET || "dev_secret";
  }

  function extractUserIdFromSub(sub) {
    const s = String(sub || "").trim();
    // expected: "local|<mongoId>"
    if (s.includes("|")) {
      const [, id] = s.split("|");
      return String(id || "").trim() || null;
    }
    // fallback: maybe already an id
    return s || null;
  }

  // Rutas permitidas aunque el usuario deba cambiar contraseña
  function isAllowedPath(pathname = "") {
    const p = String(pathname || "");

    // ✅ Permitir flujos de auth/otp/reset
    if (p.startsWith("/api/public/v1/auth")) return true; // login-otp, verify-otp, resend-otp, reset-password-otp...
    if (p.startsWith("/api/iam/v1/auth")) return true; // si tienes auth local ahí
    if (p.includes("/auth/change-password")) return true;

    // (Opcional) permitir endpoints públicos:
    if (p.startsWith("/api/health")) return true;

    return false;
  }

  export default async function forcePasswordChange(req, res, next) {
    try {
      // Si es una ruta permitida, no bloqueamos nunca
      if (isAllowedPath(req.path)) return next();

      const token = getTokenFromHeader(req);
      if (!token) return next(); // sin token -> que lo maneje tu auth normal

      const decoded = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] });
      req.auth = { payload: decoded };

      const userId = extractUserIdFromSub(decoded?.sub);
      if (!userId) {
        return res.status(401).json({ ok: false, error: "invalid_token_sub" });
      }

      const user = await IamUser.findById(userId).select("mustChangePassword active").lean();
      if (!user) {
        return res.status(401).json({ ok: false, error: "user_invalid" });
      }

      if (user.active === false) {
        return res.status(403).json({ ok: false, error: "user_inactive" });
      }

      // Si debe cambiar contraseña y NO está en ruta permitida => bloquear
      if (user.mustChangePassword) {
        return res.status(403).json({
          ok: false,
          error: "must_change_password",
          message: "Debe cambiar su contraseña antes de continuar",
        });
      }

      return next();
    } catch (err) {
      // Token inválido / expirado: dejamos que tu auth principal decida (o podrías 401)
      return next();
    }
  }