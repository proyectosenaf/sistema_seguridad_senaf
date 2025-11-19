// server/modules/rondasqr/services/alerts.service.js
import RqAlert from "../models/RqAlert.model.js";
import RqDevice from "../models/RqDevice.model.js";

const INACT_MIN = Number(process.env.RQ_INACTIVITY_MIN || 60);

/**
 * Detecta dispositivos inactivos y crea alertas de "immobility"
 */
export async function detectInactivity() {
  const limit = new Date(Date.now() - INACT_MIN * 60 * 1000);

  const stale = await RqDevice.find({ lastPingAt: { $lt: limit } }).lean();

  for (const d of stale) {
    const gps =
      d.loc &&
      Array.isArray(d.loc.coordinates) &&
      d.loc.coordinates.length === 2 &&
      d.loc.coordinates.every((n) => Number.isFinite(n))
        ? { lat: d.loc.coordinates[1], lon: d.loc.coordinates[0] }
        : undefined;

    await RqAlert.create({
      type: "immobility",
      at: new Date(),
      siteId: d.siteId || undefined,
      roundId: d.roundId || undefined,
      officerName: d.guardName || "",
      officerEmail: d.guardEmail || "",
      gps,
      steps: d.steps || 0,
      meta: {
        guardId: d.guardId || "",
        deviceId: String(d._id || ""),
        lastPingAt: d.lastPingAt || null,
      },
    });
  }
}

/**
 * Crea una alerta de pánico
 * @param {{ guardId?: string, guardName?: string, siteId?: any, roundId?: any, loc?: {lat:number, lon:number}, steps?: number }} params
 */
export async function raisePanic({
  guardId,
  guardName,
  siteId,
  roundId,
  loc,
  steps,
}) {
  const gps =
    loc && typeof loc.lat === "number" && typeof loc.lon === "number"
      ? { lat: loc.lat, lon: loc.lon }
      : undefined;

  return RqAlert.create({
    type: "panic",
    at: new Date(),
    siteId: siteId || undefined,
    roundId: roundId || undefined,
    officerName: guardName || "",
    gps,
    steps: typeof steps === "number" ? steps : 0,
    meta: {
      guardId: guardId || "",
    },
  });
}
