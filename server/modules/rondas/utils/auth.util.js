// server/utils/auth.util.js
/**
 * Middleware muy simple para proteger rutas cuando no tienes Auth0 conectado aún.
 * En producción lo puedes reemplazar con validación JWT real.
 */

export function requireAuth(req, res, next) {
  // Si usas Auth0 o Passport, aquí deberías validar el token real.
  const fakeUser = {
    sub: req.headers["x-user-id"] || "user-dev",
    roles: (req.headers["x-roles"] || "guard").split(","),
  };
  req.user = fakeUser;
  next();
}

/**
 * Middleware opcional para verificar roles.
 * Uso: router.post("/ruta", requireAuth, requireRole("admin"), handler)
 */
export function requireRole(role) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Acceso denegado: requiere rol " + role });
    }
    next();
  };
}
