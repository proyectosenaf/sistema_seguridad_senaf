// server/modules/supervision/supervision.controller.js
import { Supervision } from "./supervision.model.js";

/**
 * POST /api/supervision
 * Crea un registro de supervisión.
 */
export async function crearSupervision(req, res) {
  try {
    const body = req.body || {};

    // Info del usuario autenticado (si viene Auth0/IAM)
    const authUser = req.user || {};
    const authPayload = (req.auth && req.auth.payload) || {};

    const supervisadoPorId =
      authUser.sub || authPayload.sub || "";
    const supervisadoPorEmail =
      authUser.email || authPayload.email || "";
    const supervisadoPorNombre =
      authPayload.name || authUser.name || "";

    const doc = await Supervision.create({
      personaId: body.personaId || "",
      personaNombre: body.personaNombre || "",

      limpiezaAreaTrabajo: !!body.limpiezaAreaTrabajo,
      herramientasAMano: !!body.herramientasAMano,
      vestimentaAdecuada: !!body.vestimentaAdecuada,

      observacion: body.observacion || "",
      sitio: body.sitio || "",

      supervisadoPorId,
      supervisadoPorEmail,
      supervisadoPorNombre,
    });

    return res.status(201).json({
      ok: true,
      item: doc,
    });
  } catch (e) {
    console.error("[Supervision] Error al crear:", e);
    return res.status(500).json({
      ok: false,
      error: "Error al guardar la supervisión",
    });
  }
}

/**
 * GET /api/supervision
 * Lista supervisiones con filtros opcionales:
 *  - personaId
 *  - desde (ISO date)
 *  - hasta (ISO date)
 *  - limit
 */
export async function listarSupervisiones(req, res) {
  try {
    const { personaId, desde, hasta, limit } = req.query || {};
    const filtro = {};

    if (personaId) {
      filtro.personaId = String(personaId);
    }

    if (desde || hasta) {
      filtro.createdAt = {};
      if (desde) filtro.createdAt.$gte = new Date(desde);
      if (hasta) filtro.createdAt.$lte = new Date(hasta);
    }

    const max = Math.min(Number(limit) || 50, 200);

    const items = await Supervision.find(filtro)
      .sort({ createdAt: -1 })
      .limit(max)
      .lean();

    return res.json({
      ok: true,
      items,
      total: items.length,
    });
  } catch (e) {
    console.error("[Supervision] Error al listar:", e);
    return res.status(500).json({
      ok: false,
      error: "Error al listar supervisiones",
    });
  }
}
