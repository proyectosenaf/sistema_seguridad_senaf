// src/controllers/rondas.controller.js
import Route from "../models/Route.js";
import Guard from "../models/Guard.js";
import RondaShift from "../models/RondaShift.js";
import RondaEvent from "../models/RondaEvent.js";

/** util: calcula lateness y resultado según SLA/orden */
function evaluateCheck({ route, checkpoint, shift, now }) {
  const cpOrder = checkpoint?.order ?? 0;
  const start = shift.startedAt?.getTime?.() ?? now.getTime();
  const expectedAt = start + (checkpoint?.expectedSecondsFromStart ?? 0) * 1000;
  const grace = (checkpoint?.graceSeconds ?? 120) * 1000;
  const lateTh = (route?.sla?.lateThresholdSeconds ?? 180) * 1000;

  const latencyMs = Math.max(0, now.getTime() - expectedAt);
  const isLate = latencyMs > lateTh;
  return {
    order: cpOrder,
    latencySec: Math.round(latencyMs / 1000),
    result: checkpoint ? (isLate ? "late" : "ok") : "invalid",
  };
}

export const RondasController = {
  async listRoutes(req, res) {
    const siteId = req.query.siteId || undefined;
    const q = siteId ? { siteId, active: true } : { active: true };
    const routes = await Route.find(q).select("name code checkpoints order windows sla").lean();
    res.json(routes);
  },

  async activeShifts(_req, res) {
    const list = await RondaShift.find({ status: "active" })
      .select("routeId guardId startedAt metrics expectedCount deviceId appVersion")
      .sort({ startedAt: -1 })
      .lean();
    res.json(list);
  },

  async startShift(req, res) {
    const { routeId, guardExternalId, deviceId, appVersion } = req.body;
    const route = await Route.findById(routeId).lean();
    if (!route) return res.status(404).json({ error: "Ruta no encontrada" });

    let guard = await Guard.findOne({ externalId: guardExternalId });
    if (!guard) {
      // autocreate opcional
      guard = await Guard.create({ externalId: guardExternalId, name: guardExternalId });
    }

    const expected = route.checkpoints.length;
    const shift = await RondaShift.create({
      siteId: route.siteId,
      routeId: route._id,
      guardId: guard._id,
      expectedCount: expected,
      deviceId,
      appVersion,
    });

    // broadcast
    req.app.get("io")?.emit("rondas:shift-started", {
      id: shift._id,
      routeId: route._id,
      guardId: guard.externalId,
      ts: Date.now(),
    });

    res.status(201).json(shift);
  },

  async finishShift(req, res) {
    const { id } = req.params;
    const shift = await RondaShift.findById(id);
    if (!shift) return res.status(404).json({ error: "Shift no encontrado" });
    if (shift.status !== "active") return res.json(shift);

    shift.status = "finished";
    shift.finishedAt = new Date();

    // scoring simple (completados / esperados * 100)
    const expected = Math.max(1, shift.expectedCount);
    shift.metrics.score = Math.round((shift.metrics.completedCount / expected) * 100);

    await shift.save();

    req.app.get("io")?.emit("rondas:shift-finished", { id: shift._id, ts: Date.now() });
    res.json(shift);
  },

  async check(req, res) {
    const { shiftId, checkpointCode, method, methodMeta, location, evidences } = req.body;
    const shift = await RondaShift.findById(shiftId);
    if (!shift || shift.status !== "active") {
      return res.status(400).json({ error: "Shift inválido o finalizado" });
    }

    const route = await Route.findById(shift.routeId).lean();
    const cp = route.checkpoints.find(c => c.code === checkpointCode);

    const now = new Date();
    const evalRes = evaluateCheck({ route, checkpoint: cp, shift, now });

    // actualiza métricas
    if (evalRes.result === "ok") {
      shift.metrics.completedCount += 1;
    } else if (evalRes.result === "late") {
      shift.metrics.completedCount += 1;
      shift.metrics.lateCount += 1;
    } else if (evalRes.result === "invalid") {
      shift.metrics.invalidCount += 1;
    }
    await shift.save();

    const event = await RondaEvent.create({
      type: "check",
      shiftId: shift._id,
      routeId: route._id,
      guardId: shift.guardId,
      checkpointCode,
      checkpointName: cp?.name,
      order: evalRes.order,
      method,
      methodMeta,
      ts: now,
      result: evalRes.result,
      latencySec: evalRes.latencySec,
      location,
      evidences,
      deviceId: shift.deviceId,
      appVersion: shift.appVersion,
    });

    // broadcast de evento en vivo
    req.app.get("io")?.emit("rondas:check", {
      ts: event.ts,
      guardId: String(shift.guardId),
      checkpointCode,
      checkpoint: { name: cp?.name },
      method,
      result: event.result,
      latencySec: event.latencySec,
    });

    res.status(201).json(event);
  },
};
