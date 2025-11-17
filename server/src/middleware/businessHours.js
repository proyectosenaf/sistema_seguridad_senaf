// server/middlewares/businessHours.js

/**
 * Middleware para validar que una cita se agenda
 * SOLO en horario de atención:
 *  - Mañana: 08:00–12:00
 *  - Tarde:  13:00–17:00
 *
 * Se usa en: POST /api/citas
 */
export function enforceBusinessHours(req, res, next) {
  try {
    // La fecha/hora de la cita viene normalmente en req.body.citaAt
    const raw = req.body?.citaAt;

    // Si no viene, usamos la hora actual solo para validar
    const dt = raw ? new Date(raw) : new Date();

    if (Number.isNaN(dt.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Fecha/hora de la cita no es válida",
      });
    }

    const hour = dt.getHours(); // 0–23

    const inMorning = hour >= 8 && hour < 12;   // 08:00–11:59
    const inAfternoon = hour >= 13 && hour < 17; // 13:00–16:59

    if (!inMorning && !inAfternoon) {
      return res.status(400).json({
        ok: false,
        error:
          "La cita debe programarse en horario de atención (08:00–12:00 o 13:00–17:00).",
      });
    }

    // ✅ sigue el flujo normal
    return next();
  } catch (err) {
    console.error("[businessHours] error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error validando horario de atención" });
  }
}
