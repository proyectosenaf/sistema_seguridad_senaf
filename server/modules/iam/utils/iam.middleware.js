// Si ya tienes requireAuth en otro módulo, reúsalo:
import { requireAuth } from "../../rondas/utils/auth.util.js"; // o copia aquí el mismo

// iamEnrich: asegura req.user y sus permisos (si vienen en el token/headers)
export function iamEnrich(req, _res, next) {
  // si ya enriqueces en otro middleware, aquí puedes no-op
  next();
}

// Permiso RBAC
export function iamAllowPerm(perm) {
  return (req, res, next) => {
    const perms = req.user?.permissions || req.user?.perms || [];
    if (Array.isArray(perms) && perms.includes(perm)) return next();
    return res.status(403).json({ ok: false, error: "forbidden", need: perm });
  };
}

export { requireAuth };
