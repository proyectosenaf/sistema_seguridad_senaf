import RqMark from "../models/RqMark.model.js";
import RqAlert from "../models/RqAlert.model.js";

// Ejecuta cada 2 minutos. Crea alerta si:
// - han pasado >= IMMOBILITY_MINUTES sin nuevas marcas del oficial
// - y no existe una alerta de inmovilidad reciente (< IMMOBILITY_MINUTES)
export function startImmobilityWatcher({ io, intervalMs = 120000, minutes = null } = {}) {
  const IMM_MINS = Number(process.env.RONDASQR_IMMOBILITY_MINUTES || minutes || 60);
  const WINDOW_MS = IMM_MINS * 60 * 1000;

  async function tick() {
    try {
      // Última marca por oficial
      const lastByOfficer = await RqMark.aggregate([
        { $sort: { at: -1 } },
        {
          $group: {
            _id: { officerEmail: "$officerEmail", officerName: "$officerName" },
            lastAt: { $first: "$at" },
            lastGps: { $first: "$gps" },
          },
        },
      ]);

      const now = Date.now();
      for (const o of lastByOfficer) {
        if (!o?._id?.officerEmail && !o?._id?.officerName) continue;
        const lastTs = new Date(o.lastAt).getTime();
        if (!lastTs) continue;
        if (now - lastTs < WINDOW_MS) continue;

        // ¿ya hay alerta de inmovilidad reciente?
        const recent = await RqAlert.findOne({
          type: "immobility",
          "meta.officerKey": o._id.officerEmail || o._id.officerName,
          at: { $gte: new Date(now - WINDOW_MS) },
        }).lean();
        if (recent) continue;

        const item = await RqAlert.create({
          type: "immobility",
          gps: o.lastGps || null,
          officerEmail: o._id.officerEmail,
          officerName:  o._id.officerName,
          meta: { officerKey: o._id.officerEmail || o._id.officerName, lastAt: o.lastAt },
        });

        io?.emit?.("rondasqr:alert", { type: "immobility", item });
        // Aquí podrías invocar SMS/Email si configuras proveedor
      }
    } catch (e) {
      console.warn("[immobility.worker] error:", e?.message || e);
    }
  }

  const t = setInterval(tick, intervalMs);
  tick(); // primera ejecución
  return () => clearInterval(t);
}
