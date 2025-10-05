// server/modules/rondas/jobs/missedChecker.js
import cron from "node-cron";
// Tu modelo real de turnos:
import Shift from "../models/PatrolShift.model.js";
import Alert from "../models/Alert.js";

/* ======================
 *  Utilidades internas
 * ====================== */
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const toMs = (sec, defMs = 0) => {
  const n = toNumber(sec);
  return Number.isFinite(n) ? n * 1000 : defMs;
};
const now = () => new Date();

/* =============================================================
 *  Carga opcional del modelo de Ruta/Plan (sin romper el server)
 *  Intenta varios nombres típicos: Route.js, Route.model.js, Plan.model.js
 * ============================================================= */
let _RouteModel = null;
async function loadRouteModel(logger = console) {
  if (_RouteModel) return _RouteModel;
  const candidates = [
    "../models/Route.js",
    "../models/Route.model.js",
    "../models/Plan.model.js",
  ];
  for (const rel of candidates) {
    try {
      const m = await import(rel);
      const picked = m?.default || m?.Route || m?.Plan || null;
      if (picked) {
        _RouteModel = picked;
        logger?.info?.(`[jobs:missedCheck] usando ${rel}`);
        return _RouteModel;
      }
    } catch {
      /* probar siguiente */
    }
  }
  logger?.warn?.("[jobs:missedCheck] Route/Plan model no encontrado; uso SLA por defecto y sin backfill");
  return null;
}

/** Obtiene SLA en ms con defaults de seguridad */
function getSlaMs(route) {
  // Defaults: 180s late, 600s missed
  const lateMs    = toMs(route?.sla?.lateThresholdSeconds,    180_000);
  const missingMs = toMs(route?.sla?.missingThresholdSeconds, 600_000);
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
  const addMs = (toNumber(cpFromRoute.expectedSecondsFromStart) || 0) * 1000;
  progressItem.expectedAt = new Date(t0 + addMs);
  if (progressItem.graceSeconds == null && cpFromRoute.graceSeconds != null) {
    progressItem.graceSeconds = cpFromRoute.graceSeconds;
  }
  return progressItem;
}

/** Busca metadatos (name/order) del CP en la Route */
function getCpMetaFromRoute(route, code) {
  if (!route || !code) return {};
  const cp = (route.checkpoints || []).find((c) => c?.code === code);
  return cp ? { name: cp.name, order: cp.order } : {};
}

/** Crea (si no existe) una alerta de missed_checkpoint para el par shiftId+cpCode */
async function ensureMissedAlert({ shift, route, p }) {
  const cpCode = p.code;
  if (!cpCode) return null;

  const existing = await Alert.findOne({
    shiftId: shift._id,
    kind: "missed_checkpoint",
    status: { $in: ["open", "ack"] },
    "meta.cpCode": cpCode,
  }).lean();
  if (existing) return null;

  const metaFromRoute = getCpMetaFromRoute(route, cpCode);
  const name  = p.name  || metaFromRoute.name  || cpCode;
  const order = p.order ?? metaFromRoute.order ?? undefined;

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
    title: "Checkpoint omitido",
    message: `Punto omitido: ${name} (${cpCode}) en la ruta`,
    meta: { cpCode, order, expectedAt: p.expectedAt },
    source: "system",
    opened: { by: "system", note: "auto" },
    createdBy: "system",
    tags: ["rondas", "missed", route?.code || String(route?._id || "")],
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
      if (typeof al.close === "function") {
        al.close({ by: "system", note: "checkpoint escaneado posteriormente" });
      } else {
        al.status = "closed";
      }
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
    const expectedTs = new Date(p.expectedAt).getTime();
    if (!Number.isFinite(expectedTs)) continue;

    const deadline = expectedTs + (missingThresholdMs || 0);
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

  // Cargar modelo de Route/Plan de forma opcional
  const RouteModel = await loadRouteModel(logger);

  // 1) Rondas activas
  const q = { status: "active" };
  const cursor = Shift.find(q).cursor();

  for await (const shift of cursor) {
    processed++;
    if (limitShifts && processed > limitShifts) break;

    let route = null;
    if (RouteModel && shift.routeId) {
      try {
        route = await RouteModel.findById(shift.routeId).lean();
      } catch {
        route = null;
      }
    }

    const { missingMs } = getSlaMs(route);
    const cpMap = route ? mapCheckpoints(route) : new Map();

    // Backfill expectedAt/graceSeconds si hace falta (solo si hay route)
    let anyBackfill = false;
    if (route && Array.isArray(shift.progress)) {
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
export function startMissedCheckCron({
  cron: cronExpr = "*/2 * * * *",
  timezone = process.env.TZ, // opcional
  logger = console,
} = {}) {
  if (_task) {
    logger?.warn?.("[jobs:missedCheck] cron ya estaba iniciado; lo reinicio…");
    _task.stop();
  }
  _task = cron.schedule(
    cronExpr,
    async () => {
      try {
        await runMissedCheck({ logger });
      } catch (err) {
        logger?.error?.("[jobs:missedCheck] error", { err: err?.message || err });
      }
    },
    timezone ? { timezone } : undefined
  );
  _task.start();
  logger?.info?.("[jobs:missedCheck] cron iniciado", { cron: cronExpr, timezone: timezone || "system" });
  return _task;
}

/** Detiene el cron si estuviera activo */
export function stopMissedCheckCron() {
  if (_task) {
    _task.stop();
    _task = null;
  }
}
