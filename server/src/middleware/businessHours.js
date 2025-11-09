// server/middlewares/businessHours.js

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function withinRanges(date) {
  const m = minutesOf(date);
  const AM_START = 8 * 60;   // 08:00
  const AM_END   = 12 * 60;  // 12:00 (excluido)
  const PM_START = 13 * 60;  // 13:00
  const PM_END   = 17 * 60;  // 17:00 (excluido)
  return (m >= AM_START && m < AM_END) || (m >= PM_START && m < PM_END);
}

/**
 * Valida que la hora de la cita esté dentro de 8:00–12:00 o 13:00–17:00.
 * Lee del body: fecha | scheduledAt | fechaEntradaProgramada | (fechaDia + hora)
 */
export function enforceBusinessHours(req, res, next) {
  try {
    let fechaStr =
      req.body?.fecha ||
      req.body?.scheduledAt ||
      req.body?.fechaEntradaProgramada;

    // Alternativa: fecha y hora por separado (YYYY-MM-DD + HH:mm)
    if (!fechaStr && req.body?.fechaDia && req.body?.hora) {
      fechaStr = `${req.body.fechaDia}T${req.body.hora}:00`;
    }

    const dt = new Date(fechaStr);
    if (!dt || isNaN(dt)) {
      return res.status(400).json({
        ok: false,
        error: "Fecha/hora inválida o no enviada.",
      });
    }

    if (!withinRanges(dt)) {
      return res.status(400).json({
        ok: false,
        error:
          "La cita debe estar entre 8:00–12:00 o 13:00–17:00 (12:00 y 17:00 no permitidas).",
      });
    }

    next();
  } catch (err) {
    console.error("[enforceBusinessHours] error:", err);
    res.status(500).json({ ok: false, error: "Error validando horario de la cita." });
  }
}
