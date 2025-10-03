// src/controllers/rondas.controller.js
import QRCode from "qrcode";

import Route from "../models/Route.js";
import Guard from "../models/Guard.js";
import RondaShift from "../models/RondaShift.js";
import RouteAssignment from "../models/RouteAssignment.js";
import Scan from "../models/Scan.js";
import Alert from "../models/Alert.js";
// (Opcional si quieres abrir incidentes desde el check)
// import Incident from "../models/Incident.js";

/** =========================
 * Helpers
 * ========================= */

// Obtiene io desde req (middleware) o desde la app
function getIO(req) {
  return req.io || req.app?.get?.("io");
}

function emit(io, event, payload) {
  try { io?.emit(event, payload); } catch (_e) {}
}

/** Evalúa tardanza según SLA de la ruta */
function evaluateLatency({ route, checkpoint, shift, now }) {
  const cpOrder = checkpoint?.order ?? 0;
  const start = shift.startedAt instanceof Date ? shift.startedAt.getTime() : now.getTime();
  const expectedAt = start + (checkpoint?.expectedSecondsFromStart ?? 0) * 1000;
  const lateTh = (route?.sla?.lateThresholdSeconds ?? 180) * 1000;

  const latencyMs = Math.max(0, now.getTime() - expectedAt);
  const isLate = latencyMs > lateTh;

  return {
    order: cpOrder,
    expectedAt: new Date(expectedAt),
    latencySec: Math.round(latencyMs / 1000),
    result: checkpoint ? (isLate ? "late" : "ok") : "invalid",
  };
}

/** Crea (si no existe) un Guard por externalId (Auth0 sub) */
async function ensureGuardByExternalId(externalId) {
  if (!externalId) return null;
  let guard = await Guard.findOne({ externalId });
  if (!guard) {
    guard = await Guard.create({ externalId, name: externalId });
  }
  return guard;
}

/** Busca una asignación activa y vigente para guardia+ruta "ahora" */
async function findActiveAssignmentForNow({ routeId, guardId, at = new Date(), siteId }) {
  const list = await RouteAssignment.findActiveForGuard(guardId, { siteId, at });
  const forRoute = list.filter((a) => String(a.routeId) === String(routeId));
  // Verifica shouldWorkNow()
  return forRoute.find((a) => a.shouldWorkNow(at)) || null;
}

/** =========================
 * Controller
 * ========================= */

export const RondasController = {
  /** GET /api/rondas/routes?siteId=... */
  async listRoutes(req, res) {
    try {
      const siteId = req.query.siteId || undefined;
      const q = siteId ? { siteId, active: true } : { active: true };

      const routes = await Route.find(q)
        .select("siteId name code checkpoints windows sla active")
        .lean();

      return res.json(routes);
    } catch (err) {
      console.error("[rondas] listRoutes error:", err);
      return res.status(500).json({ error: "Error listando rutas" });
    }
  },

  /** GET /api/rondas/active */
  async activeShifts(_req, res) {
    try {
      const list = await RondaShift.find({ status: "active" })
        .populate({ path: "routeId", select: "name" })
        .select("routeId guardId guardExternalId guardName startedAt metrics expectedCount deviceId appVersion siteId status lastScan")
        .sort({ startedAt: -1 })
        .lean();

      const normalized = list.map((s) => ({
        ...s,
        route: s.routeId && typeof s.routeId === "object"
          ? { id: s.routeId._id, name: s.routeId.name }
          : null,
        routeId: s.routeId?._id ?? s.routeId,
      }));

      return res.json(normalized);
    } catch (err) {
      console.error("[rondas] activeShifts error:", err);
      return res.status(500).json({ error: "Error listando rondas activas" });
    }
  },

  /** POST /api/rondas/shifts/start
   * body: { routeId, guardExternalId, deviceId?, appVersion? }
   */
  async startShift(req, res) {
    try {
      const { routeId, guardExternalId, deviceId, appVersion } = req.body;
      if (!routeId || !guardExternalId) {
        return res.status(400).json({ error: "routeId y guardExternalId son requeridos" });
      }

      const route = await Route.findById(routeId);
      if (!route || !route.active) return res.status(404).json({ error: "Ruta no encontrada o inactiva" });

      const guard = await ensureGuardByExternalId(guardExternalId);
      if (!guard) return res.status(400).json({ error: "Guardia inválido" });

      // Verifica asignación/ventana vigente (si existe)
      const assignment = await findActiveAssignmentForNow({
        routeId: route._id,
        guardId: guard._id,
        at: new Date(),
        siteId: route.siteId,
      });

      // Construye shift con progreso desde la ruta
      const shift = new RondaShift({
        siteId: route.siteId,
        routeId: route._id,
        assignmentId: assignment?._id,
        guardId: guard._id,
        guardExternalId,
        guardName: guard.name,
        deviceId,
        appVersion,
      });

      shift.initFromRoute(route); // usa buildExpectedTimeline si existe
      await shift.save();

      const io = getIO(req);
      emit(io, "rondas:shift-started", {
        id: String(shift._id),
        routeId: String(route._id),
        guardExternalId,
        guardId: String(guard._id),
        ts: Date.now(),
      });

      return res.status(201).json(shift.toJSON());
    } catch (err) {
      console.error("[rondas] startShift error:", err);
      return res.status(500).json({ error: "Error iniciando la ronda" });
    }
  },

  /** POST /api/rondas/shifts/:id/finish
   * body: { reason?, endedByUserId? }
   */
  async finishShift(req, res) {
    try {
      const { id } = req.params;
      const { reason, endedByUserId } = req.body || {};
      const shift = await RondaShift.findById(id);
      if (!shift) return res.status(404).json({ error: "Shift no encontrado" });

      if (shift.status !== "active") {
        return res.json(shift.toJSON());
      }

      const route = await Route.findById(shift.routeId).lean();
      const missingThMs = (route?.sla?.missingThresholdSeconds ?? 600) * 1000;

      shift.finish({ missingThresholdMs: missingThMs, endedByUserId, reason });
      await shift.save();

      // Generar alertas por "missed" recién marcados (opcional)
      const missed = (shift.progress || []).filter((p) => p.status === "missed");
      if (missed.length) {
        const bulk = missed.map((p) => ({
          siteId: shift.siteId,
          routeId: shift.routeId,
          assignmentId: shift.assignmentId,
          shiftId: shift._id,
          guardId: shift.guardId,
          guardExternalId: shift.guardExternalId,
          guardName: shift.guardName,
          kind: "missed_checkpoint",
          severity: "medium",
          status: "open",
          message: `Punto omitido: ${p.name} (${p.code})`,
          meta: { cpCode: p.code, order: p.order, expectedAt: p.expectedAt },
          source: "system",
          opened: { by: "system", note: "auto" },
          createdBy: "system",
        }));
        if (bulk.length) {
          await Alert.insertMany(bulk, { ordered: false }).catch(() => {});
        }
      }

      const io = getIO(req);
      emit(io, "rondas:shift-finished", { id: String(shift._id), ts: Date.now() });

      return res.json(shift.toJSON());
    } catch (err) {
      console.error("[rondas] finishShift error:", err);
      return res.status(500).json({ error: "Error finalizando la ronda" });
    }
  },

  /** POST /api/rondas/shifts/:id/check
   * body: {
   *   cpCode, method?, gps?, notes?, photos?, rawPayload?, clientAt?, device?
   * }
   */
  async check(req, res) {
    try {
      const { id } = req.params;
      const {
        cpCode,
        method = "qr",
        gps,
        notes,
        photos,
        rawPayload,
        clientAt,
        device,
      } = req.body;

      if (!cpCode) return res.status(400).json({ error: "cpCode es requerido" });

      const shift = await RondaShift.findById(id);
      if (!shift || shift.status !== "active") {
        return res.status(400).json({ error: "Shift inválido o finalizado" });
      }

      const route = await Route.findById(shift.routeId);
      if (!route) return res.status(404).json({ error: "Ruta no encontrada para el shift" });

      const cp = route.getCheckpointByCode?.(cpCode) ||
        (Array.isArray(route.checkpoints) ? route.checkpoints.find((c) => c.code === cpCode) : undefined);

      const now = new Date();

      // Evalúa tardanza aproximada (para feedback rápido)
      const evalRes = evaluateLatency({ route, checkpoint: cp, shift, now });

      // Actualiza progreso de shift con lógica robusta del modelo
      const scanMeta = { method, gps, notes, photos, deviceId: shift.deviceId, appVersion: shift.appVersion };
      const reg = shift.registerScan({ cpCode, at: now, meta: scanMeta, lateThresholdMs: (route.sla?.lateThresholdSeconds ?? 180) * 1000 });
      await shift.save();

      // Crea Scan persistente (registro de auditoría)
      const scan = new Scan({
        siteId: route.siteId,
        routeId: route._id,
        assignmentId: shift.assignmentId,
        shiftId: shift._id,

        guardId: shift.guardId,
        guardExternalId: shift.guardExternalId,
        guardName: shift.guardName,

        cpCode,
        cpName: cp?.name,
        cpOrder: cp?.order ?? evalRes.order,

        expectedAt: reg.progressItem?.expectedAt || evalRes.expectedAt,
        scannedAt: now,
        clientAt: clientAt ? new Date(clientAt) : undefined,

        result: reg.status, // ok/late/invalid (invalid puede venir luego por geocerca)
        method,
        gps,
        photos,
        notes,
        rawPayload,
        device: device || { deviceId: shift.deviceId, appVersion: shift.appVersion },

        createdBy: shift.guardExternalId || "system",
      });

      // Geocerca si el CP la tiene
      if (cp?.geofence && gps?.lat && gps?.lng) {
        scan.applyGeofenceCheck(cp.geofence, gps);
        if (scan.geofence && scan.geofence.within === false) {
          scan.result = "invalid";
        }
      }

      // Ajuste de tardanza por SLA
      scan.markLateIfNeeded((route.sla?.lateThresholdSeconds ?? 180) * 1000);
      await scan.save();

      // Alertas automáticas
      const io = getIO(req);
      if (scan.result === "late") {
        const alert = await Alert.create({
          siteId: route.siteId,
          routeId: route._id,
          assignmentId: shift.assignmentId,
          shiftId: shift._id,
          scanId: scan._id,

          guardId: shift.guardId,
          guardExternalId: shift.guardExternalId,
          guardName: shift.guardName,

          kind: "late_scan",
          severity: "medium",
          status: "open",
          message: `Escaneo tardío en ${cp?.name || cpCode} (${cpCode})`,
          meta: { cpCode, order: cp?.order ?? evalRes.order, expectedAt: scan.expectedAt, scannedAt: scan.scannedAt },
          source: "system",
          opened: { by: "system", note: "auto" },
          createdBy: "system",
        });
        emit(io, "alert:new", alert.toJSON());
      } else if (scan.result === "invalid") {
        const alert = await Alert.create({
          siteId: route.siteId,
          routeId: route._id,
          assignmentId: shift.assignmentId,
          shiftId: shift._id,
          scanId: scan._id,

          guardId: shift.guardId,
          guardExternalId: shift.guardExternalId,
          guardName: shift.guardName,

          kind: "invalid_scan",
          severity: "high",
          status: "open",
          message: `Escaneo inválido en ${cp?.name || cpCode} (${cpCode})`,
          meta: { cpCode, order: cp?.order ?? evalRes.order, geofence: scan.geofence },
          source: "system",
          opened: { by: "system", note: "auto" },
          createdBy: "system",
        });
        emit(io, "alert:new", alert.toJSON());
      }

      // Evento en tiempo real para monitores
      emit(io, "rondas:check", {
        ts: scan.scannedAt,
        shiftId: String(shift._id),
        routeId: String(route._id),
        guardExternalId: shift.guardExternalId,
        cpCode,
        checkpoint: { name: cp?.name, order: cp?.order },
        method,
        result: scan.result,
        latencySec: evalRes.latencySec,
      });

      return res.status(201).json(scan.toJSON());
    } catch (err) {
      console.error("[rondas] check error:", err);
      return res.status(500).json({ error: "Error registrando el checkpoint" });
    }
  },

  // ---------------------------------------------------------------------------
  // QR de checkpoint (PNG/SVG)
  // GET /api/rondas/qr/checkpoint?routeId=...&code=...&fmt=svg|png&download=1&label=1
  // ---------------------------------------------------------------------------
  async qrCheckpoint(req, res) {
    try {
      const { routeId, code, fmt = "svg", download = "0", label = "0" } = req.query;
      if (!routeId || !code) return res.status(400).json({ error: "routeId y code requeridos" });

      const route = await Route.findById(routeId).lean();
      if (!route) return res.status(404).json({ error: "Ruta no encontrada" });

      const cp = (route.checkpoints || []).find((c) => c.code === code);
      if (!cp) return res.status(404).json({ error: "Checkpoint no encontrado" });

      const qrPayload = `SENAF|CHK|${routeId}|${code}`; // simple y robusto

      if (fmt === "png") {
        const buf = await QRCode.toBuffer(qrPayload, {
          type: "png",
          errorCorrectionLevel: "M",
          margin: 1,
          scale: 8,
        });
        if (download === "1") {
          res.setHeader("Content-Disposition", `attachment; filename="qr-${route.name}-${code}.png"`);
        }
        res.setHeader("Content-Type", "image/png");
        return res.end(buf);
      }

      // SVG
      let svg = await QRCode.toString(qrPayload, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 6,
      });

      if (label === "1") {
        const safeRoute = (route.name || "").replace(/[<>&]/g, "");
        const safeCp = (cp.name || code).replace(/[<>&]/g, "");
        svg = svg.replace(
          "</svg>",
          `<text x="50%" y="98%" text-anchor="middle" font-size="14" font-family="sans-serif">${safeRoute} · ${safeCp}</text></svg>`
        );
      }

      if (download === "1") {
        res.setHeader("Content-Disposition", `attachment; filename="qr-${route.name}-${code}.svg"`);
      }
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      return res.send(svg);
    } catch (err) {
      console.error("[rondas] qrCheckpoint error:", err);
      return res.status(500).json({ error: "Error generando QR" });
    }
  },

  // ---------------------------------------------------------------------------
  // ASIGNACIONES (CRUD básico)
  // ---------------------------------------------------------------------------

  /** GET /api/rondas/assignments?guardId=&active= */
  async listAssignments(req, res) {
    try {
      const { guardId, active } = req.query;
      const q = {};
      if (guardId) q.guardId = guardId;
      if (active !== undefined) q.active = active === "true";

      const items = await RouteAssignment.find(q)
        .populate({ path: "routeId", select: "name checkpoints siteId" })
        .populate({ path: "guardId", select: "externalId name" })
        .sort({ createdAt: -1 })
        .lean();

      const normalized = items.map((a) => ({
        ...a,
        route: a.routeId ? { id: a.routeId._id, name: a.routeId.name } : null,
        guard: a.guardId ? { id: a.guardId._id, name: a.guardId.name, externalId: a.guardId.externalId } : null,
        routeId: a.routeId?._id ?? a.routeId,
        guardId: a.guardId?._id ?? a.guardId,
      }));

      return res.json(normalized);
    } catch (err) {
      console.error("[rondas] listAssignments error:", err);
      return res.status(500).json({ error: "Error listando asignaciones" });
    }
  },

  /** POST /api/rondas/assignments
   * body: {
   *   routeId, guardExternalId, active?,
   *   daysOfWeek?, startTime?, endTime?, frequencyMinutes?,
   *   activeFrom?, activeTo?, skipDates?, overrideDates?, timezone?
   * }
   */
  async createAssignment(req, res) {
    try {
      const {
        routeId, guardExternalId, active = true,
        daysOfWeek, startTime, endTime, frequencyMinutes,
        activeFrom, activeTo, skipDates, overrideDates, timezone,
        notes,
      } = req.body || {};

      if (!routeId || !guardExternalId) {
        return res.status(400).json({ error: "routeId y guardExternalId son requeridos" });
      }

      const route = await Route.findById(routeId).lean();
      if (!route) return res.status(404).json({ error: "Ruta no encontrada" });

      const guard = await ensureGuardByExternalId(guardExternalId);
      if (!guard) return res.status(400).json({ error: "Guardia inválido" });

      const asg = await RouteAssignment.create({
        siteId: route.siteId,
        routeId: route._id,
        guardId: guard._id,
        guardName: guard.name,
        daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        frequencyMinutes: typeof frequencyMinutes === "number" ? frequencyMinutes : undefined,
        activeFrom: activeFrom ? new Date(activeFrom) : undefined,
        activeTo: activeTo ? new Date(activeTo) : undefined,
        skipDates: Array.isArray(skipDates) ? skipDates : undefined,
        overrideDates: Array.isArray(overrideDates) ? overrideDates : undefined,
        timezone: timezone || undefined,
        active,
        createdBy: req.user?.sub || "admin",
        notes,
      });

      return res.status(201).json(asg.toJSON());
    } catch (err) {
      console.error("[rondas] createAssignment error:", err);
      return res.status(500).json({ error: "Error creando asignación" });
    }
  },

  /** PATCH /api/rondas/assignments/:id
   * body: mismos campos opcionales que create
   */
  async updateAssignment(req, res) {
    try {
      const { id } = req.params;
      const payload = { ...req.body };
      if (payload.activeFrom) payload.activeFrom = new Date(payload.activeFrom);
      if (payload.activeTo) payload.activeTo = new Date(payload.activeTo);
      const asg = await RouteAssignment.findByIdAndUpdate(id, payload, { new: true });
      if (!asg) return res.status(404).json({ error: "Asignación no encontrada" });
      return res.json(asg.toJSON());
    } catch (err) {
      console.error("[rondas] updateAssignment error:", err);
      return res.status(500).json({ error: "Error actualizando asignación" });
    }
  },

  /** DELETE /api/rondas/assignments/:id */
  async deleteAssignment(req, res) {
    try {
      const { id } = req.params;
      const del = await RouteAssignment.findByIdAndDelete(id);
      if (!del) return res.status(404).json({ error: "Asignación no encontrada" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[rondas] deleteAssignment error:", err);
      return res.status(500).json({ error: "Error eliminando asignación" });
    }
  },
};
