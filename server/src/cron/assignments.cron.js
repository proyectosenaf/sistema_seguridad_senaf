// server/src/cron/assignments.cron.js
import cron from "node-cron";
import RqRound from "../../modules/rondasqr/models/RqRound.model.js";
import RqSite from "../../modules/rondasqr/models/RqSite.model.js";
import RqPlan from "../../modules/rondasqr/models/RqPlan.model.js";
import RqAssignment from "../../modules/rondasqr/models/RqAssignment.model.js";
import IamUser from "../../modules/iam/models/IamUser.model.js";

/* ───────────────── helpers ───────────────── */

function todayStrHN(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function inferTimesByRoundName(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("diurn")) return { startTime: "06:00", endTime: "18:00" };
  if (n.includes("nocturn")) return { startTime: "18:00", endTime: "06:00" };
  if (n.includes("mediod") || n.includes("meridian")) return { startTime: "12:00", endTime: "18:00" };
  return { startTime: undefined, endTime: undefined };
}

async function getPlanSnapshot(siteId, roundId) {
  const plan = await RqPlan.findOne({ siteId, roundId, active: true }).lean();
  if (!plan) return { planId: null, planSnap: [] };

  const ordered = (plan.points || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((p) => ({
      pointId: p.pointId,
      order: p.order || 0,
      windowStartMin: p.windowStartMin,
      windowEndMin: p.windowEndMin,
      toleranceMin: p.toleranceMin,
    }));

  return { planId: plan._id, planSnap: ordered };
}

function pickGuardId(user) {
  // Mantengo tu lógica: en tu sistema guardId se está usando como string.
  return user?.sub || user?.legacyId || (user?._id ? String(user._id) : null);
}

function hasGuardRole(user) {
  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.[NS]) ? user[NS] : []),
  ]
    .map((r) => String(r).toLowerCase().trim())
    .filter(Boolean);

  return roles.includes("guardia") || roles.includes("guard") || roles.includes("rondasqr.guard");
}

/* ───────────────── core ───────────────── */

export async function generateAssignmentsForDate(date, { notifier } = {}) {
  const rounds = await RqRound.find({ active: true }).lean();
  if (!rounds.length) return { created: 0, skipped: 0 };

  const users = await IamUser.find({ active: true }).lean();
  const guards = users.filter(hasGuardRole);

  let created = 0;
  let skipped = 0;

  const siteIds = Array.from(new Set(rounds.map((r) => String(r.siteId || "")).filter(Boolean)));
  const sites = siteIds.length
    ? await RqSite.find({ _id: { $in: siteIds } }).select({ name: 1 }).lean()
    : [];
  const siteNameById = sites.reduce((acc, s) => ((acc[String(s._id)] = s.name || ""), acc), {});

  for (const r of rounds) {
    const siteName = siteNameById[String(r.siteId || "")] || "";
    const roundName = r?.name || "";
    const inferred = inferTimesByRoundName(roundName);
    const { planId, planSnap } = await getPlanSnapshot(r.siteId, r._id);

    for (const g of guards) {
      const guardId = pickGuardId(g);
      if (!guardId) {
        skipped++;
        continue;
      }

      // ✅ exists estable (usa mismo tipo que guardId, aquí string)
      const exists = await RqAssignment.exists({ date, guardId, roundId: r._id });
      if (exists) {
        skipped++;
        continue;
      }

      const doc = await RqAssignment.create({
        date,
        guardId,
        // compat (por si hay código viejo leyendo guardUserId)
        guardUserId: guardId,

        roundId: r._id,
        siteId: r.siteId || undefined,
        status: "assigned",
        startTime: inferred.startTime,
        endTime: inferred.endTime,
        planId,
        planSnap,
        notified: false,
        notifiedAt: undefined,
        notifiedBy: null,
      });

      created++;

      try {
        if (notifier && typeof notifier.assignment === "function") {
          await notifier.assignment({
            userId: guardId,
            email: g?.email || null,
            siteName,
            roundName,
            startTime: doc.startTime,
            endTime: doc.endTime,
            assignmentId: String(doc._id),
          });

          await RqAssignment.updateOne(
            { _id: doc._id },
            { $set: { notified: true, notifiedAt: new Date(), notifiedBy: "socket" } }
          );
        }
      } catch (e) {
        console.warn("[cron.assignments.notify] aviso:", e?.message || e);
      }
    }
  }

  return { created, skipped };
}

/* ───────────────── scheduler ───────────────── */

export function startDailyAssignmentCron(app) {
  // ✅ Por defecto Honduras
  const tz = process.env.TZ || "America/Tegucigalpa";
  const spec = process.env.CRON_ASSIGN || "0 0 * * *";

  cron.schedule(
    spec,
    async () => {
      try {
        // ✅ HOY Honduras (no UTC)
        const today = todayStrHN();
        const notifier = app?.get?.("notifier") || null;
        const { created, skipped } = await generateAssignmentsForDate(today, { notifier });
        console.log(`[cron] assignments ${today} -> created=${created} skipped=${skipped}`);
      } catch (e) {
        console.error("[cron] error:", e?.message || e);
      }
    },
    { timezone: tz }
  );

  console.log(`[cron] assignDailyRounds scheduled "${spec}" (${tz})`);
}
