// src/jobs/missedCheck.js
import cron from "node-cron";
import RondaShift from "../models/RondaShift.js";
import Route from "../models/Route.js";
import Alert from "../models/Alert.js";

/** ===== Utilidades internas ===== */
const toMs = (sec, def = 0) => (Number.isFinite(sec) ? sec * 1000 : def);
const now = () => new Date();

/** Obtiene SLA en ms con defaults de seguridad */
function getSlaMs(route) {
  const lateMs    = toMs(route?.sla?.lateThresholdSeconds, 180000);  // 180s
  const missingMs = toMs(route?.sla?.missingThresholdSeconds, 600000); // 600s
  return { lateMs, missingMs };
}

/** Construye un mapa { code -> checkpoint } para lookup rápido */
function mapCheckpoints(route) {
  const map = new Map();
  for (const cp of route?.checkpoints || []) {
    if (!cp?.code) continue;
    map.set(cp.code, cp);
  }
  return map;
}

/** Reconstruye expectedAt si está ausente usando startedAt + expectedSecondsFromStart de la Route */
function backfillExpectedAt(progressItem, cpFromRoute, startedAt) {
  if (progressItem?.expectedAt || !cpFromRoute) return progressItem;
  const t0 = startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  const add = (cpFromRoute.expectedSecondsFromStart || 0) * 1000;
  progressItem.expectedAt = new Date(t0 + add);
  // ajusta graceSeconds si faltaba
  if (progressItem.graceSeconds == null && cpFromRoute.graceSeconds != null) {
    progressItem.graceSeconds = cpFromRoute.graceSeconds;
  }
  return progressItem;
}

/** Crea (si no existe) una alerta de missed_checkpoint para el par shiftId+cpCode */
async function ensureMissedAlert({ shift, route, p }) {
  const existing = await Alert.findOne({
    shiftId: shift._id,
    kind: "missed_checkpoint",
    status: { $in: ["open", "ack"] },
    "meta.cpCode": p.code,
  }).lean();

  if (existing) return null;

  const alert = await Alert.create({
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
    title: `Checkpoint omitido`,
    message: `Punto omitido: ${p.name} (${p.code}) en la ruta`,
    meta: {
      cpCode: p.code,
      order: p.order,
      expectedAt: p.expectedAt,
    },
    source: "system",
    opened: { by: "system", note: "auto" },
    createdBy: "system",
    tags: ["rondas", "missed", route?.code || route?._id?.toString()],
  });

  return alert;
}

/** Cierra alertas de missed para los CP ya escaneados (ok|late) */
async function reconcileClosedAlertsForScanned({ shift }) {
  const scannedCodes = new Set(
    (shift.progress || [])
      .filter((p) => p.scannedAt && (p.status === "ok" || p.status === "late"))
      .map((p) => p.code)
  );
  if (!scannedCodes.size) return 0;

  const openMissed = await Alert.find({
    shiftId: shift._id,
    kind: "missed_checkpoint",
    status: { $in: ["open", "ack"] },
  });

  let closed = 0;
  for (const al of openMissed) {
    const cpCode = al?.meta?.cpCode;
    if (cpCode && scannedCodes.has(cpCode)) {
      al.close({ by: "system", note: "checkpoint escaneado posteriormente" });
      await al.save();
      closed++;
    }
  }
  return closed;
}

/** Marca como missed los CP pendientes que ya superaron expectedAt + missingThresholdMs */
function markMissedPendingInMemory({ shift, missingThresholdMs, nowDate }) {
  if (!Array.isArray(shift.progress) || !shift.progress.length) return [];
  const newlyMissed = [];

  for (const p of shift.progress) {
    if (p.status !== "pending" || !p.expectedAt) continue;

    const deadline = new Date(p.expectedAt).getTime() + (missingThresholdMs || 0);
    if (nowDate.getTime() > deadline) {
      p.status = "missed";
      newlyMissed.push(p);
    }
  }
  return newlyMissed;
}

/** Ejecuta una pasada de verificación de rondas activas */
export async function runMissedCheck({ dryRun = false, limitShifts = 0, logger = console } = {}) {
  const startedAt = Date.now();
  let processed = 0, changed = 0, alertsCreated = 0, alertsClosed = 0, reconstructedEta = 0;

  // 1) Rondas activas (puedes filtrar por antigüedad si quieres)
  const q = { status: "active" };
  let cursor = RondaShift.find(q).cursor();

  for await (const shift of cursor) {
    processed++;
    if (limitShifts && processed > limitShifts) break;

    const route = await Route.findById(shift.routeId).lean();
    if (!route) continue;

    const { missingMs } = getSlaMs(route);
    const cpMap = mapCheckpoints(route);

    // Backfill expectedAt si hace falta (robustez)
    let anyBackfill = false;
    if (Array.isArray(shift.progress)) {
      for (const p of shift.progress) {
        if (!p?.expectedAt) {
          const cpRt = cpMap.get(p.code);
          const before = p.expectedAt;
          backfillExpectedAt(p, cpRt, shift.startedAt);
          if (!before && p.expectedAt) {
            reconstructedEta++;
            anyBackfill = true;
          }
        }
        // también asegura graceSeconds sensata
        if (p.graceSeconds == null) {
          const cpRt = cpMap.get(p.code);
          if (cpRt?.graceSeconds != null) p.graceSeconds = cpRt.graceSeconds;
        }
      }
    }

    // 2) Marcar missed en memoria
    const newlyMissed = markMissedPendingInMemory({
      shift,
      missingThresholdMs: missingMs,
      nowDate: now(),
    });

    // 3) Persistir shift si hubo cambios (pre-save recalcula métricas)
    if ((newlyMissed.length || anyBackfill) && !dryRun) {
      await shift.save();
      changed++;
    }

    // 4) Crear alertas por cada nuevo missed (dedupe por shift+cpCode)
    if (!dryRun) {
      for (const p of newlyMissed) {
        const alert = await ensureMissedAlert({ shift, route, p });
        if (alert) alertsCreated++;
      }
    }

    // 5) Reconciliar alertas `missed_checkpoint` cuando el CP ya fue escaneado
    if (!dryRun) {
      alertsClosed += await reconcileClosedAlertsForScanned({ shift });
    }
  }

  const tookMs = Date.now() - startedAt;
  logger?.info?.("[jobs:missedCheck] done", {
    processed, changed, alertsCreated, alertsClosed, reconstructedEta, tookMs,
  });
  return { processed, changed, alertsCreated, alertsClosed, reconstructedEta, tookMs };
}

/** Programa el job con node-cron (default: cada 2 minutos) */
let _task = null;
export function startMissedCheckCron({ cron: cronExpr = "*/2 * * * *", logger = console } = {}) {
  if (_task) {
    logger?.warn?.("[jobs:missedCheck] cron ya estaba iniciado; lo reinicio…");
    _task.stop();
  }
  _task = cron.schedule(cronExpr, async () => {
    try {
      await runMissedCheck({ logger });
    } catch (err) {
      logger?.error?.("[jobs:missedCheck] error", { err: err?.message || err });
    }
  });
  _task.start();
  logger?.info?.("[jobs:missedCheck] cron iniciado", { cron: cronExpr });
  return _task;
}

/** Detiene el cron si estuviera activo */
export function stopMissedCheckCron() {
  if (_task) {
    _task.stop();
    _task = null;
  }
}
