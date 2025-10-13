// server/modules/iam/routes/auth.routes.js
import { Router } from "express";

/**
 * Esta ruta lee lo que haya puesto el enriquecedor (req.iam)
 * para entregar un /auth/me sencillo y que no dependa de JWT.
 * El módulo principal también expone /me y /auth/me más completo;
 * mantenemos este endpoint para compatibilidad.
 */
const r = Router();

r.get("/me", (req, res) => {
  const iam = req.iam || {};
  res.json({
    ok: true,
    user: {
      email: iam.email || null,
      id: iam.userId || null,
      name: iam.name || null,
    },
    roles: iam.roles || [],
    permissions: iam.permissions || [],
  });
});

export default r;
