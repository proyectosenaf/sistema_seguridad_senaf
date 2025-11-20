// controllers/movimientosManual.controller.js
import MovimientoManual from '../models/MovimientoManual.js';
export async function crearMovimientoManual(req, res) {
  try {
    const { fechaHora, fechaFin, noRegresa, tipo, personaId,
            persona, placa, observacion, departamento } = req.body;
    const mov = new MovimientoManual({
      fechaHora: new Date(fechaHora),
      fechaFin: noRegresa ? null : fechaFin ? new Date(fechaFin) : null,
      noRegresa: !!noRegresa,
      tipo, personaId: personaId || null, persona, placa,
      observacion, departamento,
    });
    await mov.save();
    res.status(201).json({ ok: true, item: mov });
  } catch (err) {
    console.error('[acceso] crearMovimientoManual', err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function listarMovimientosManual(req, res) {
  try {
    const { personaId, departamento, desde, hasta, tipo } = req.query;
    const filter = {};
    if (personaId) filter.personaId = personaId;
    if (departamento) filter.departamento = departamento;
    if (tipo) filter.tipo = tipo;
    if (desde || hasta) {
      filter.fechaHora = {};
      if (desde) filter.fechaHora.$gte = new Date(desde);
      if (hasta) {
        const dateUntil = new Date(hasta);
        dateUntil.setDate(dateUntil.getDate() + 1);
        filter.fechaHora.$lt = dateUntil;
      }
    }
    const items = await MovimientoManual.find(filter)
      .sort({ fechaHora: -1 })
      .lean();
    res.json({ ok: true, items });
  } catch (err) {
    console.error('[acceso] listarMovimientosManual', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
