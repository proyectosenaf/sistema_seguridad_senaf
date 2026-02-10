// server/middlewares/ensureUsuario.js
import Usuario from "../models/Usuario.js";
import Persona from "../models/Persona.js";

/**
 * Middleware que garantiza que exista un `req.usuario`.
 *
 * - Si viene `ID_usuarios` (legacy, numérico) y NO hay JWT, busca por `legacyId`.
 * - Si hay JWT (Auth0 u otro), hace upsert por `sub` del token.
 * - Si no hay ni JWT ni legacyId, deja `req.usuario` como undefined y sigue.
 */
export async function ensureUsuario(req, _res, next) {
  try {
    // 1) MODO LEGACY: ID_usuarios en el body y sin JWT
    if (!req.auth?.payload && req.body?.ID_usuarios) {
      const legacyId = Number(req.body.ID_usuarios);
      if (!Number.isNaN(legacyId)) {
        const u = await Usuario.findOne({ legacyId });
        if (u) {
          req.usuario = u;
        }
      }
      return next();
    }

    // 2) MODO JWT: intentar obtener el "payload" de forma robusta
    //    (según el middleware de auth puede venir como req.auth.payload, req.auth, req.user, etc.)
    const rawAuth =
      req.auth?.payload || // caso típico de express-oauth2-jwt-bearer
      req.auth || // algunos auth middlewares dejan el payload aquí
      req.user || // passport / middlewares custom
      null;

    if (!rawAuth) {
      // No hay token → seguimos sin usuario asociado
      return next();
    }

    const payload = {
      sub: rawAuth.sub,
      name: rawAuth.name || rawAuth.nickname || rawAuth.given_name,
      email: rawAuth.email,
    };

    if (!payload.sub) {
      // Token raro sin sub: no intentamos upsert
      return next();
    }

    const updates = {
      nombre: payload.name || payload.email || "Sin nombre",
      email: payload.email,
    };

    const usuario = await Usuario.findOneAndUpdate(
      { sub: payload.sub },
      {
        $set: updates,
        $setOnInsert: { activo: true },
      },
      {
        new: true,
        upsert: true,
      }
    );

    // 3) Enlaza a Persona por email si aún no la tiene
    if (!usuario.persona && usuario.email) {
      const p = await Persona.findOne({ email: usuario.email }).select("_id");
      if (p) {
        usuario.persona = p._id;
        await usuario.save();
      }
    }

    req.usuario = usuario;
    return next();
  } catch (err) {
    // En caso de fallo, logueamos y pasamos error al siguiente middleware
    console.error("[ensureUsuario] error:", err);
    return next(err);
  }
}
