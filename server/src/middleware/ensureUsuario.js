import Usuario from "../models/Usuario.js";
import Persona from "../models/Persona.js";

export async function ensureUsuario(req, _res, next) {
  try {
    // Si viene ID_usuarios legacy en el body **y** no hay JWT, úsalo.
    if (!req.auth?.payload && req.body?.ID_usuarios) {
      const u = await Usuario.findOne({ legacyId: Number(req.body.ID_usuarios) });
      if (u) req.usuario = u;
      return next();
    }

    // Si hay JWT (Auth0), upsert por sub
    const payload = req.auth?.payload;
    if (!payload) return next();

    const updates = {
      nombre: payload.name || payload.nickname,
      email: payload.email,
    };

    const usuario = await Usuario.findOneAndUpdate(
      { sub: payload.sub },
      { $set: updates, $setOnInsert: { activo: true } },
      { new: true, upsert: true }
    );

    // (Opcional) enlaza a Persona por email si aún no la tiene
    if (!usuario.persona && usuario.email) {
      const p = await Persona.findOne({ email: usuario.email }).select("_id");
      if (p) {
        usuario.persona = p._id;
        await usuario.save();
      }
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}
// Si no hay JWT ni legacyId, no hace nada y sigue (req.usuario queda undefined)