// server/src/middleware/forcePasswordChange.js
// Middleware para forzar cambio de contraseña
// Creado el 19/02/2026 para implementar cambio de contraseña y vencimiento

import IamUser from "../../modules/iam/models/IamUser.model.js";

function extractUserIdFromSub(sub) {
  const s = String(sub || "").trim();

  // Esperado: "local|<mongoId>"
  if (s.includes("|")) {
    const [, id] = s.split("|");
    return String(id || "").trim() || null;
  }

  // Fallback: puede venir ya el id directo
  return s || null;
}

// Rutas permitidas aunque el usuario deba cambiar contraseña
function isAllowedPath(pathname = "") {
  const p = String(pathname || "");

  // ✅ Permitir flujos de auth/otp/reset
  if (p.startsWith("/api/public/v1/auth")) return true;
  if (p.startsWith("/public/v1/auth")) return true;

  if (p.startsWith("/api/public/v1/password")) return true;
  if (p.startsWith("/public/v1/password")) return true;

  if (p.startsWith("/api/iam/v1/auth")) return true;
  if (p.startsWith("/iam/v1/auth")) return true;

  if (p.includes("/auth/change-password")) return true;
  if (p.includes("/force-change-password")) return true;

  // Endpoints públicos útiles
  if (p.startsWith("/api/health")) return true;
  if (p === "/health") return true;

  return false;
}

function resolveAuthPayload(req) {
  if (req?.auth?.payload) return req.auth.payload;

  if (req?.user) {
    return {
      sub: req.user.sub || null,
      email: req.user.email || null,
      name: req.user.name || null,
      provider: req.user.provider || null,
    };
  }

  return null;
}

export default async function forcePasswordChange(req, res, next) {
  try {
    // Si es una ruta permitida, no bloqueamos nunca
    if (isAllowedPath(req.path)) return next();

    const payload = resolveAuthPayload(req);

    // Sin identidad autenticada, que siga el flujo normal
    if (!payload) return next();

    const userId = extractUserIdFromSub(payload?.sub);
    if (!userId) {
      return next();
    }

    const user = await IamUser.findById(userId)
      .select("mustChangePassword active")
      .lean();

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "user_invalid",
      });
    }

    if (user.active === false) {
      return res.status(403).json({
        ok: false,
        error: "user_inactive",
      });
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
    console.error("[forcePasswordChange] error:", err?.message || err);
    return next(err);
  }
}