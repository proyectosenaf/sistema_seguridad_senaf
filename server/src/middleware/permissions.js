// Middleware de permisos sencillo (Auth0 RBAC).
// Lee los permisos del access token en req.auth.payload.permissions (express-oauth2-jwt-bearer).
// Si pones DISABLE_RBAC=1 en .env, se omite la verificación (útil en desarrollo).

const BYPASS = process.env.DISABLE_RBAC === "1";

export function requirePermissions(...required) {
  const needed = required.flat().filter(Boolean);
  return (req, res, next) => {
    if (BYPASS || needed.length === 0) return next();

    const perms =
      (req.auth && req.auth.payload && req.auth.payload.permissions) ||
      req.user?.permissions ||
      [];

    const ok = needed.every((p) => perms.includes(p));
    if (!ok) {
      return res.status(403).json({
        error: "forbidden",
        required: needed,
        have: perms,
      });
    }
    next();
  };
}
// Si quieres más control, puedes hacer un middleware por rol, o por propiedad del recurso, etc.
// Ejemplo: requireRole("admin"), o requireOwnership(model, "createdBy.sub"), etc.
// También puedes usar algo como casl o accesscontrol para RBAC/ABAC más avanzado.
// Más info: https://auth0.com/docs/authorization/rbac/implementation/nodejs-express   