// services/alerts.service.js
import RqAlert from "../models/RqAlert.model.js";
import RqDevice from "../models/RqDevice.model.js";
const INACT_MIN = Number(process.env.RQ_INACTIVITY_MIN || 60);

export async function detectInactivity() {
  const limit = new Date(Date.now() - INACT_MIN*60*1000);
  const stale = await RqDevice.find({ lastPingAt: { $lt: limit } }).lean();
  for (const d of stale) {
    await RqAlert.create({ type: "INACTIVITY", guardId: d.guardId, at: new Date(), details: { lastPingAt: d.lastPingAt } });
  }
}
export async function raisePanic({ guardId, guardName, loc }) {
  return RqAlert.create({ type:"PANIC", guardId, guardName, loc, at: new Date() });
}
